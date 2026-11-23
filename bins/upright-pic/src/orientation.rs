use std::sync::Arc;

use anyhow::{Result, ensure};
use image::{DynamicImage, imageops, metadata::Orientation};
use tract_onnx::prelude::*;

const MODEL: &[u8] = include_bytes!("../assets/pp-lcnet-doc-ori.onnx");
const SIDE: usize = 224;
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

pub struct Classifier(Arc<TypedRunnableModel>);

pub enum Decision {
    Upright(f32),
    Rotate { quarter_turns: u8, score: f32 },
    Uncertain { score: f32, reason: &'static str },
}

impl Classifier {
    pub fn load() -> Result<Self> {
        let model = tract_onnx::onnx()
            .model_for_read(&mut &MODEL[..])?
            .with_input_fact(0, f32::fact([1, 3, SIDE, SIDE]).into())?
            .into_optimized()?
            .into_runnable()?;
        Ok(Self(model))
    }

    pub fn classify(
        &self,
        image: &DynamicImage,
        exif: Orientation,
        threshold: f32,
    ) -> Result<Decision> {
        let mut sample = model_sample(image);
        sample.apply_orientation(exif);
        let result = self.predict(&sample)?;
        if !result.reliable(threshold) {
            return Ok(Decision::Uncertain {
                score: result.score,
                reason: "low model confidence or small lead",
            });
        }
        if result.label == 0 {
            return Ok(Decision::Upright(result.score));
        }
        let quarter_turns = 4 - result.label;
        sample.apply_orientation(clockwise(quarter_turns));
        let check = self.predict(&sample)?;
        if check.label != 0 || !check.reliable(threshold) {
            return Ok(Decision::Uncertain {
                score: result.score,
                reason: "rotated preview did not pass the upright check",
            });
        }
        Ok(Decision::Rotate {
            quarter_turns,
            score: result.score.min(check.score),
        })
    }

    fn predict(&self, sample: &DynamicImage) -> Result<Prediction> {
        let mut input = vec![0.0f32; 3 * SIDE * SIDE];
        let rgba = sample.to_rgba8();
        for (i, &image::Rgba([r, g, b, a])) in rgba.pixels().enumerate() {
            let alpha = f32::from(a) / 255.0;
            for (ch, value) in [r, g, b].into_iter().enumerate() {
                let value = f32::from(value) / 255.0 * alpha + (1.0 - alpha);
                input[ch * SIDE * SIDE + i] = (value - MEAN[ch]) / STD[ch];
            }
        }
        let input = Tensor::from_shape(&[1, 3, SIDE, SIDE], &input)?;
        let output = self.0.run(tvec!(input.into_tvalue()))?;
        let scores = output[0].to_plain_array_view::<f32>()?;
        let mut ranked: Vec<_> = scores.iter().copied().enumerate().collect();
        ensure!(
            ranked.len() == 4 && ranked.iter().all(|(_, score)| (0.0..=1.0).contains(score)),
            "invalid direction probabilities from model"
        );
        ranked.sort_unstable_by(|a, b| b.1.total_cmp(&a.1));
        Ok(Prediction {
            label: ranked[0].0 as u8,
            score: ranked[0].1,
            lead: ranked[0].1 - ranked[1].1,
        })
    }
}

fn model_sample(image: &DynamicImage) -> DynamicImage {
    use DynamicImage::*;
    let (width, height) = (image.width(), image.height());
    let side = (width.min(height) * 7 / 8).max(1);
    let (x, y) = ((width - side) / 2, (height - side) / 2);
    let size = SIDE as u32;
    let filter = imageops::FilterType::Triangle;
    macro_rules! resize_view {
        ($pixels:expr, $variant:ident) => {
            $variant(imageops::resize(
                &*imageops::crop_imm($pixels, x, y, side, side),
                size,
                size,
                filter,
            ))
        };
    }
    match image {
        ImageLuma8(pixels) => resize_view!(pixels, ImageLuma8),
        ImageLumaA8(pixels) => resize_view!(pixels, ImageLumaA8),
        ImageRgb8(pixels) => resize_view!(pixels, ImageRgb8),
        ImageRgba8(pixels) => resize_view!(pixels, ImageRgba8),
        ImageLuma16(pixels) => resize_view!(pixels, ImageLuma16),
        ImageLumaA16(pixels) => resize_view!(pixels, ImageLumaA16),
        ImageRgb16(pixels) => resize_view!(pixels, ImageRgb16),
        ImageRgba16(pixels) => resize_view!(pixels, ImageRgba16),
        ImageRgb32F(pixels) => resize_view!(pixels, ImageRgb32F),
        ImageRgba32F(pixels) => resize_view!(pixels, ImageRgba32F),
        _ => image
            .crop_imm(x, y, side, side)
            .resize_exact(size, size, filter),
    }
}

struct Prediction {
    label: u8,
    score: f32,
    lead: f32,
}

impl Prediction {
    fn reliable(&self, threshold: f32) -> bool {
        self.score >= threshold && self.lead >= 0.20
    }
}

pub fn clockwise(turns: u8) -> Orientation {
    [
        Orientation::NoTransforms,
        Orientation::Rotate90,
        Orientation::Rotate180,
        Orientation::Rotate270,
    ][usize::from(turns % 4)]
}

pub fn compose(exif: Orientation, turns: u8) -> Orientation {
    use Orientation::*;
    let (rotation, flipped) = match exif {
        NoTransforms => (0, false),
        Rotate90 => (1, false),
        Rotate180 => (2, false),
        Rotate270 => (3, false),
        FlipHorizontal => (0, true),
        Rotate90FlipH => (1, true),
        FlipVertical => (2, true),
        Rotate270FlipH => (3, true),
    };
    if flipped {
        [FlipHorizontal, Rotate90FlipH, FlipVertical, Rotate270FlipH]
            [usize::from((rotation + 4 - turns) % 4)]
    } else {
        clockwise(rotation + turns)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GrayImage, Luma, Rgb, RgbImage};

    #[test]
    fn borrowed_sample_matches_owned_crop() {
        let image = DynamicImage::ImageRgb8(RgbImage::from_fn(701, 483, |x, y| {
            Rgb([x as u8, y as u8, (x ^ y) as u8])
        }));
        let side = image.height() * 7 / 8;
        let expected = image
            .crop_imm(
                (image.width() - side) / 2,
                (image.height() - side) / 2,
                side,
                side,
            )
            .resize_exact(SIDE as u32, SIDE as u32, imageops::FilterType::Triangle);
        assert_eq!(model_sample(&image), expected);
    }

    #[test]
    fn composed_transform_matches_exif_then_rotation() {
        let original =
            DynamicImage::ImageLuma8(GrayImage::from_fn(3, 2, |x, y| Luma([(x + 3 * y) as u8])));
        for tag in 1..=8 {
            let exif = Orientation::from_exif(tag).unwrap();
            for turns in 0..4 {
                let mut expected = original.clone();
                expected.apply_orientation(exif);
                expected.apply_orientation(clockwise(turns));
                let mut actual = original.clone();
                actual.apply_orientation(compose(exif, turns));
                assert_eq!(actual, expected, "EXIF {tag}, turns {turns}");
            }
        }
    }
}
