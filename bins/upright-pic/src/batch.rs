use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Instant,
};

use anyhow::{Context, Result, ensure};
use image::metadata::Orientation;
use rayon::prelude::*;
use walkdir::{DirEntry, WalkDir};

use crate::{
    codecs::{self, Format, HeicCodec, Input},
    orientation::{Classifier, Decision, compose},
    output::{Output, safe_regular, write_original},
};

const MAX_FILE_BYTES: u64 = 128 * 1024 * 1024;

pub fn run(
    source: &Path,
    output: &Output,
    jobs: usize,
    threshold: f32,
    report: &mut impl Write,
) -> Result<bool> {
    let start = Instant::now();
    let classifier = Classifier::load().context("could not load embedded orientation model")?;
    let heic = HeicCodec::load();
    let pipeline = Pipeline {
        source,
        output,
        classifier,
        heic,
        threshold,
    };
    let workers = rayon::ThreadPoolBuilder::new().num_threads(jobs).build()?;
    let entries = WalkDir::new(source)
        .follow_links(false)
        .into_iter()
        .filter_entry(traversable);
    let mut results: Vec<_> = workers.install(|| {
        entries
            .filter_map(|entry| match entry {
                Ok(entry) if entry.file_type().is_file() => {
                    let format = Format::from_path(entry.path())?;
                    Some(Ok((entry.into_path(), format)))
                }
                Ok(_) => None,
                Err(error) => Some(Err(error)),
            })
            .par_bridge()
            .map(|entry| match entry {
                Ok((path, format)) => {
                    let result = pipeline.process(&path, format);
                    (path, result)
                }
                Err(error) => (error.path().unwrap_or(source).to_owned(), Err(error.into())),
            })
            .collect()
    });
    results.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));
    report_results(results, start, report)
}

fn traversable(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    #[cfg(windows)]
    if let Ok(metadata) = entry.metadata() {
        return !crate::output::is_reparse_point(&metadata);
    }
    !entry.file_type().is_symlink()
}

struct Pipeline<'a> {
    source: &'a Path,
    output: &'a Output,
    classifier: Classifier,
    heic: HeicCodec,
    threshold: f32,
}

impl Pipeline<'_> {
    fn process(&self, path: &Path, format: Format) -> Result<FileReport> {
        let relative = path.strip_prefix(self.source)?;
        let file = fs::File::open(path)?;
        let metadata = file.metadata()?;
        ensure!(
            safe_regular(&fs::symlink_metadata(path)?) && safe_regular(&metadata),
            "not a regular file"
        );
        ensure!(metadata.len() <= MAX_FILE_BYTES, "file exceeds 128 MiB");
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        file.take(MAX_FILE_BYTES + 1).read_to_end(&mut bytes)?;
        ensure!(bytes.len() as u64 <= MAX_FILE_BYTES, "file exceeds 128 MiB");
        let image = match codecs::decode(format, &bytes, &self.heic)? {
            Input::Still(image) => image,
            Input::Unsupported(reason) => {
                return self.unchanged(
                    path,
                    relative,
                    &metadata,
                    &bytes,
                    "skip",
                    reason.to_owned(),
                );
            }
        };
        let (turns, score) =
            match self
                .classifier
                .classify(&image.pixels, image.orientation, self.threshold)?
            {
                Decision::Uncertain { score, reason } => {
                    return self.unchanged(
                        path,
                        relative,
                        &metadata,
                        &bytes,
                        "skip",
                        format!("{reason}; score={score:.3}"),
                    );
                }
                Decision::Upright(score) if image.orientation == Orientation::NoTransforms => {
                    return self.unchanged(
                        path,
                        relative,
                        &metadata,
                        &bytes,
                        "upright",
                        format!("score={score:.3}"),
                    );
                }
                Decision::Upright(score) => (0, score),
                Decision::Rotate {
                    quarter_turns,
                    score,
                } => (quarter_turns, score),
            };

        let exif = image.orientation.to_exif();
        let transform = compose(image.orientation, turns);
        let detail = format!(
            "clockwise={} EXIF={exif} score={score:.3}",
            u16::from(turns) * 90
        );
        if let Some(dest) = self.output.destination(path, relative, true) {
            let encoding = dest.write(&metadata, |file| {
                image.write_corrected(format, transform, &bytes, &self.heic, file)
            })?;
            Ok(FileReport {
                status: "corrected",
                detail: format!("{detail}; {encoding}"),
            })
        } else {
            Ok(FileReport {
                status: "would-correct",
                detail,
            })
        }
    }

    fn unchanged(
        &self,
        path: &Path,
        relative: &Path,
        metadata: &fs::Metadata,
        bytes: &[u8],
        status: &'static str,
        mut detail: String,
    ) -> Result<FileReport> {
        if let Some(dest) = self.output.destination(path, relative, false) {
            dest.write(metadata, |file| write_original(file, bytes))?;
            detail.push_str("; copied unchanged");
        }
        Ok(FileReport { status, detail })
    }
}

struct FileReport {
    status: &'static str,
    detail: String,
}

fn report_results(
    results: Vec<(PathBuf, Result<FileReport>)>,
    start: Instant,
    writer: &mut impl Write,
) -> Result<bool> {
    let total = results.len();
    let (mut would_correct, mut corrected, mut upright, mut skipped, mut failed) = (0, 0, 0, 0, 0);
    for (path, result) in results {
        match result {
            Ok(file) => {
                match file.status {
                    "would-correct" => would_correct += 1,
                    "corrected" => corrected += 1,
                    "upright" => upright += 1,
                    _ => skipped += 1,
                }
                writeln!(writer, "{}\t{path:?}\t{}", file.status, file.detail)?;
            }
            Err(error) => {
                failed += 1;
                writeln!(writer, "error\t{path:?}\t{error:#}")?;
            }
        }
    }
    writeln!(
        writer,
        "total={total} would_correct={would_correct} corrected={corrected} upright={upright} skipped={skipped} failed={failed} elapsed={:.2}s",
        start.elapsed().as_secs_f64()
    )?;
    writer.flush()?;
    Ok(failed == 0)
}
