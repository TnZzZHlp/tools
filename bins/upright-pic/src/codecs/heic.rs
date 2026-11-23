use anyhow::{Context, Result, ensure};
use image::{DynamicImage, RgbImage, RgbaImage, metadata::Orientation};
use libheif_rs::{
    Channel, ColorProfileRaw, ColorSpace, CompressionFormat, DecodingOptions,
    EncoderParameterValue, EncoderQuality, HeifContext, Image, LibHeif, RgbChroma,
};

use super::{Input, Still, check_dimensions};

pub struct HeicCodec(LibHeif);

impl HeicCodec {
    pub fn load() -> Self {
        Self(LibHeif::new())
    }

    pub fn decode(&self, bytes: &[u8]) -> Result<Input> {
        let mut context = HeifContext::read_from_bytes(bytes)?;
        if context.image_ids().len() != 1 || !context.track_ids().is_empty() {
            return Ok(Input::Unsupported("multi-image or animated HEIF"));
        }
        let handle = context.primary_image_handle()?;
        check_dimensions(handle.width(), handle.height())?;
        ensure!(
            handle.ispe_width() > 0 && handle.ispe_height() > 0,
            "invalid HEIC dimensions"
        );
        check_dimensions(handle.ispe_width() as u32, handle.ispe_height() as u32)?;
        context.set_max_decoding_threads(1);
        let has_alpha = handle.has_alpha_channel();
        let (chroma, channels) = if has_alpha {
            (RgbChroma::Rgba, 4)
        } else {
            (RgbChroma::Rgb, 3)
        };
        let mut options = DecodingOptions::new().context("HEIC decoder options unavailable")?;
        options.set_num_library_threads(1);
        options.set_num_codec_threads(1);
        let decoded = self
            .0
            .decode(&handle, ColorSpace::Rgb(chroma), Some(options))?;
        let plane = decoded
            .planes()
            .interleaved
            .context("missing HEIC RGB plane")?;
        let (width, height) = (plane.width, plane.height);
        check_dimensions(width, height)?;
        let row_len = width as usize * channels;
        ensure!(plane.stride >= row_len, "invalid HEIC row stride");
        let mut raw = Vec::with_capacity(row_len * height as usize);
        for y in 0..height as usize {
            let start = y * plane.stride;
            raw.extend_from_slice(
                plane
                    .data
                    .get(start..start + row_len)
                    .context("truncated HEIC RGB plane")?,
            );
        }
        let pixels = if has_alpha {
            DynamicImage::ImageRgba8(
                RgbaImage::from_raw(width, height, raw).context("invalid HEIC RGBA image")?,
            )
        } else {
            DynamicImage::ImageRgb8(
                RgbImage::from_raw(width, height, raw).context("invalid HEIC RGB image")?,
            )
        };
        Ok(Input::Still(Still {
            pixels,
            orientation: Orientation::NoTransforms,
            icc: None,
            heic_profile: decoded.color_profile_raw(),
            heic_high_depth: handle.luma_bits_per_pixel() > 8,
        }))
    }

    pub fn encode(
        &self,
        pixels: DynamicImage,
        profile: Option<&ColorProfileRaw>,
    ) -> Result<Vec<u8>> {
        let mut encoder = self
            .0
            .encoder_for_format(CompressionFormat::Hevc)
            .context("no HEVC encoder available to write HEIC")?;
        encoder.set_quality(EncoderQuality::Lossy(92))?;
        if encoder
            .parameters_names()
            .iter()
            .any(|name| name == "threads")
        {
            encoder.set_parameter_value("threads", EncoderParameterValue::Int(1))?;
        }
        let (width, height) = (pixels.width(), pixels.height());
        let (raw, chroma, channels) = match pixels {
            DynamicImage::ImageRgba8(image) => (image.into_raw(), RgbChroma::Rgba, 4),
            DynamicImage::ImageRgb8(image) => (image.into_raw(), RgbChroma::Rgb, 3),
            _ => anyhow::bail!("expected 8-bit HEIC pixels"),
        };
        let mut image = Image::new(width, height, ColorSpace::Rgb(chroma))?;
        image.create_plane(Channel::Interleaved, width, height, 8)?;
        let plane = image
            .planes_mut()
            .interleaved
            .context("missing HEIC destination plane")?;
        let row_len = width as usize * channels;
        ensure!(plane.stride >= row_len, "invalid HEIC destination stride");
        for (y, row) in raw.chunks_exact(row_len).enumerate() {
            let start = y * plane.stride;
            plane
                .data
                .get_mut(start..start + row_len)
                .context("short HEIC destination plane")?
                .copy_from_slice(row);
        }
        if let Some(profile) = profile {
            image.set_color_profile_raw(profile)?;
        }
        let mut context = HeifContext::new()?;
        context.encode_image(&image, &mut encoder, None)?;
        Ok(context.write_to_bytes()?)
    }
}
