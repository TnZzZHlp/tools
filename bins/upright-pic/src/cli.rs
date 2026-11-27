use std::{
    io::{self, BufWriter},
    path::PathBuf,
};

use anyhow::{Context, Result, ensure};
use clap::Parser;

use crate::{
    batch,
    output::{Output, create_output_root},
};

#[derive(Parser)]
#[command(
    version,
    about = "Recursively correct document image orientation offline. Reports only by default."
)]
struct Args {
    #[arg(value_name = "INPUT_DIRECTORY")]
    input: PathBuf,
    #[arg(
        long,
        value_name = "NEW_DIRECTORY",
        conflicts_with = "in_place",
        help = "Write corrected images to a new directory outside the input tree"
    )]
    output: Option<PathBuf>,
    #[arg(
        long,
        requires = "output",
        help = "Also copy unchanged and skipped images to the output directory"
    )]
    copy_unchanged: bool,
    #[arg(long, help = "Replace corrected files in place without making backups")]
    in_place: bool,
    #[arg(short = 'j', long, value_parser = clap::value_parser!(u8).range(1..=64), help = "Worker count (default: all available threads)")]
    jobs: Option<u8>,
    #[arg(long, default_value_t = 0.85, value_parser = parse_confidence, help = "Minimum model score to accept a direction")]
    confidence: f32,
    #[arg(long, help = "Do not show the terminal progress bar")]
    no_progress: bool,
}

pub fn run() -> Result<bool> {
    let args = Args::parse();
    let input = args
        .input
        .canonicalize()
        .context("could not open input directory")?;
    ensure!(input.is_dir(), "input is not a directory");
    let output = match args.output {
        Some(path) => {
            let root = create_output_root(&input, &path)?;
            if args.copy_unchanged {
                Output::Mirror(root)
            } else {
                Output::Corrected(root)
            }
        }
        None if args.in_place => Output::InPlace,
        None => Output::Preview,
    };
    let jobs = args
        .jobs
        .map(usize::from)
        .unwrap_or_else(|| std::thread::available_parallelism().map_or(1, |count| count.get()));
    batch::run(
        &input,
        &output,
        jobs,
        args.confidence,
        !args.no_progress,
        &mut BufWriter::new(io::stdout().lock()),
    )
}

fn parse_confidence(value: &str) -> Result<f32, String> {
    match value.parse::<f32>() {
        Ok(value) if (0.50..=1.0).contains(&value) => Ok(value),
        _ => Err("confidence must be between 0.50 and 1.00".to_owned()),
    }
}
