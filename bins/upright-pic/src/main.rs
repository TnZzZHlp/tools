mod batch;
mod cli;
mod codecs;
mod orientation;
mod output;
mod resize;

use std::process::ExitCode;

fn main() -> ExitCode {
    match cli::run() {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(error) => {
            eprintln!("error: {error:#}");
            ExitCode::FAILURE
        }
    }
}
