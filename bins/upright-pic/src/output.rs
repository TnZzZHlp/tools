use std::{
    fs, io,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, ensure};
use same_file::Handle;
use tempfile::NamedTempFile;

pub enum Output {
    Preview,
    Corrected(PathBuf),
    Mirror(PathBuf),
    InPlace,
}

pub fn create_output_root(source: &Path, target: &Path) -> Result<PathBuf> {
    let name = target
        .file_name()
        .context("output requires a new directory name")?;
    let parent = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let parent = parent
        .canonicalize()
        .context("output parent directory must already exist")?;
    let source_id = Handle::from_path(source)?;
    for ancestor in parent.ancestors() {
        ensure!(
            Handle::from_path(ancestor)? != source_id,
            "output directory must be outside the input directory"
        );
    }
    let target = parent.join(name);
    fs::create_dir(&target)
        .with_context(|| format!("could not create new output directory {}", target.display()))?;
    Ok(target)
}

impl Output {
    pub fn destination(
        &self,
        source: &Path,
        relative: &Path,
        changed: bool,
    ) -> Option<Destination> {
        match self {
            Self::Corrected(root) if changed => Some(Destination::New(root.join(relative))),
            Self::Mirror(root) => Some(Destination::New(root.join(relative))),
            Self::InPlace if changed => Some(Destination::Replace(source.to_owned())),
            _ => None,
        }
    }
}

pub enum Destination {
    New(PathBuf),
    Replace(PathBuf),
}

impl Destination {
    pub fn write<T>(
        self,
        source: &fs::Metadata,
        write: impl FnOnce(&mut fs::File) -> Result<T>,
    ) -> Result<T> {
        let path = match &self {
            Self::New(path) | Self::Replace(path) => path,
        };
        let parent = path.parent().context("missing output parent")?;
        if matches!(self, Self::New(_)) {
            fs::create_dir_all(parent)?;
        } else {
            ensure!(!source.permissions().readonly(), "input is read-only");
        }
        let mut temp = NamedTempFile::new_in(parent)?;
        let result = write(temp.as_file_mut())?;
        match self {
            Self::New(path) => {
                temp.as_file().sync_all()?;
                temp.persist_noclobber(&path)
                    .map_err(|error| error.error)
                    .with_context(|| format!("could not create {}", path.display()))?;
            }
            Self::Replace(path) => {
                temp.as_file().set_permissions(source.permissions())?;
                temp.as_file().sync_all()?;
                let latest = fs::symlink_metadata(&path)?;
                ensure!(
                    safe_regular(&latest)
                        && latest.len() == source.len()
                        && latest.modified()? == source.modified()?,
                    "input changed during processing; not overwritten"
                );
                temp.persist(&path)
                    .map_err(|error| error.error)
                    .with_context(|| format!("could not replace {}", path.display()))?;
            }
        }
        Ok(result)
    }
}

pub fn safe_regular(metadata: &fs::Metadata) -> bool {
    metadata.is_file() && !is_reparse_point(metadata)
}

#[cfg(windows)]
pub fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & REPARSE_POINT != 0
}

#[cfg(not(windows))]
pub fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.is_symlink()
}

pub fn write_original(dest: &mut fs::File, bytes: &[u8]) -> Result<()> {
    io::copy(&mut &bytes[..], dest)?;
    Ok(())
}
