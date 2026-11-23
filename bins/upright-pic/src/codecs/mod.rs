mod heic;
mod jpeg;

use std::{
    io::{Cursor, Write},
    path::Path,
};

use anyhow::{Result, ensure};
use image::{
    DynamicImage, ImageDecoder, ImageEncoder, ImageFormat, Limits,
    codecs::{
        jpeg::{JpegDecoder, JpegEncoder},
        png::{PngDecoder, PngEncoder},
        tiff::{TiffDecoder, TiffEncoder},
        webp::{WebPDecoder, WebPEncoder},
    },
    metadata::Orientation,
};

pub use heic::HeicCodec;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Jpeg,
    Png,
    Webp,
    Tiff,
    Heic,
}

impl Format {
    pub fn from_path(path: &Path) -> Option<Self> {
        match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
            "jpg" | "jpeg" | "jpe" | "jfif" => Some(Self::Jpeg),
            "png" => Some(Self::Png),
            "webp" => Some(Self::Webp),
            "tiff" | "tif" => Some(Self::Tiff),
            "heic" | "heif" => Some(Self::Heic),
            _ => None,
        }
    }
}

pub enum Input {
    Still(Still),
    Unsupported(&'static str),
}

pub struct Still {
    pub pixels: DynamicImage,
    pub orientation: Orientation,
    icc: Option<Vec<u8>>,
    heic_profile: Option<libheif_rs::ColorProfileRaw>,
    heic_high_depth: bool,
}

pub fn decode(format: Format, bytes: &[u8], heic: &HeicCodec) -> Result<Input> {
    let cursor = Cursor::new(bytes);
    match format {
        Format::Jpeg => from_decoder(JpegDecoder::new(cursor)?),
        Format::Png => {
            let decoder = PngDecoder::new(cursor)?;
            if decoder.is_apng()? {
                return Ok(Input::Unsupported("animated PNG"));
            }
            from_decoder(decoder)
        }
        Format::Webp => {
            let decoder = WebPDecoder::new(cursor)?;
            if decoder.has_animation() {
                return Ok(Input::Unsupported("animated WebP"));
            }
            from_decoder(decoder)
        }
        Format::Tiff => {
            ensure!(
                image::guess_format(bytes)? == ImageFormat::Tiff,
                "expected TIFF data"
            );
            if tiff::decoder::Decoder::new(Cursor::new(bytes))?.more_images() {
                return Ok(Input::Unsupported("multi-page TIFF"));
            }
            from_decoder(TiffDecoder::new(cursor)?)
        }
        Format::Heic => heic.decode(bytes),
    }
}

fn from_decoder(mut decoder: impl ImageDecoder) -> Result<Input> {
    let (width, height) = decoder.dimensions();
    check_dimensions(width, height)?;
    let mut limits = Limits::default();
    limits.max_alloc = Some(256 * 1024 * 1024);
    decoder.set_limits(limits)?;
    let orientation = decoder.orientation()?;
    let icc = decoder.icc_profile()?;
    let pixels = DynamicImage::from_decoder(decoder)?;
    Ok(Input::Still(Still {
        pixels,
        orientation,
        icc,
        heic_profile: None,
        heic_high_depth: false,
    }))
}

fn check_dimensions(width: u32, height: u32) -> Result<()> {
    ensure!(
        width > 0 && height > 0 && u64::from(width) * u64::from(height) <= 50_000_000,
        "invalid dimensions or image exceeds 50 megapixels"
    );
    Ok(())
}

impl Still {
    pub fn write_corrected(
        mut self,
        format: Format,
        transform: Orientation,
        original: &[u8],
        heic: &HeicCodec,
        mut dest: impl Write + std::io::Seek,
    ) -> Result<&'static str> {
        if format == Format::Jpeg
            && let Some(bytes) = jpeg::lossless(original, transform, self.icc.as_deref())?
        {
            dest.write_all(&bytes)?;
            return Ok("lossless JPEG; non-color metadata not retained");
        }

        self.pixels.apply_orientation(transform);
        let pixels = self.pixels;
        let (width, height) = (pixels.width(), pixels.height());
        let color = pixels.color().into();
        match format {
            Format::Jpeg => {
                let mut encoder = JpegEncoder::new_with_quality(dest, 95);
                if let Some(profile) = self.icc.filter(|p| jpeg::matches_color(p, pixels.color())) {
                    encoder.set_icc_profile(profile)?;
                }
                encoder.encode_image(&pixels)?;
                Ok("JPEG re-encoded at quality 95; non-color metadata not retained")
            }
            Format::Png => {
                let mut encoder = PngEncoder::new(dest);
                if let Some(profile) = self.icc {
                    encoder.set_icc_profile(profile)?;
                }
                encoder.write_image(pixels.as_bytes(), width, height, color)?;
                Ok("PNG; non-color metadata not retained")
            }
            Format::Webp => {
                let mut encoder = WebPEncoder::new_lossless(dest);
                if let Some(profile) = self.icc {
                    encoder.set_icc_profile(profile)?;
                }
                encoder.write_image(pixels.as_bytes(), width, height, color)?;
                Ok("lossless WebP; non-color metadata not retained")
            }
            Format::Tiff => {
                let mut encoder = TiffEncoder::new(dest);
                if let Some(profile) = self.icc {
                    encoder.set_icc_profile(profile)?;
                }
                encoder.write_image(pixels.as_bytes(), width, height, color)?;
                Ok("TIFF; non-color metadata not retained")
            }
            Format::Heic => {
                dest.write_all(&heic.encode(pixels, self.heic_profile.as_ref())?)?;
                Ok(if self.heic_high_depth {
                    "HEIC re-encoded at 8 bits; HDR and other metadata may not be retained"
                } else {
                    "HEIC re-encoded; non-color metadata not retained"
                })
            }
        }
    }
}
