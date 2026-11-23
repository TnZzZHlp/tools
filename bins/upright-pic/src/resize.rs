use image::RgbImage;

pub fn rgb_triangle_crop(image: &RgbImage, x: u32, y: u32, side: u32, size: u32) -> RgbImage {
    let (side, size) = (side as usize, size as usize);
    let stride = image.width() as usize * 3;
    let row_len = side * 3;
    let origin = y as usize * stride + x as usize * 3;
    let mut vertical = vec![0.0f32; size * row_len];
    let mut weights = Vec::new();
    let mut spans = Vec::with_capacity(size);
    let ratio = side as f32 / size as f32;
    let radius = ratio.max(1.0);
    for out in 0..size {
        let center = (out as f32 + 0.5) * ratio;
        let left = ((center - radius).floor() as usize).min(side - 1);
        let right = ((center + radius).ceil() as usize).clamp(left + 1, side);
        let start = weights.len();
        let mut sum = 0.0;
        for input in left..right {
            let distance = ((input as f32 - (center - 0.5)) / radius).abs();
            let weight = (1.0 - distance).max(0.0);
            weights.push(weight);
            sum += weight;
        }
        for weight in &mut weights[start..] {
            *weight /= sum;
        }
        spans.push((left, start..weights.len()));
    }

    let source = image.as_raw();
    for ((first, range), dest) in spans.iter().zip(vertical.chunks_exact_mut(row_len)) {
        for (offset, &weight) in weights[range.clone()].iter().enumerate() {
            let from = origin + (first + offset) * stride;
            for (value, &pixel) in dest.iter_mut().zip(&source[from..from + row_len]) {
                *value += f32::from(pixel) * weight;
            }
        }
    }

    let mut result = RgbImage::new(size as u32, size as u32);
    for (row, dest) in vertical
        .chunks_exact(row_len)
        .zip(result.chunks_exact_mut(size * 3))
    {
        for ((first, range), pixel) in spans.iter().zip(dest.as_chunks_mut::<3>().0) {
            let from = first * 3;
            let window = &row[from..from + range.len() * 3];
            let mut rgb = [0.0; 3];
            for (values, &weight) in window
                .as_chunks::<3>()
                .0
                .iter()
                .zip(&weights[range.clone()])
            {
                for (value, &channel) in rgb.iter_mut().zip(values) {
                    *value += channel * weight;
                }
            }
            for (channel, value) in pixel.iter_mut().zip(rgb) {
                *channel = value.round() as u8;
            }
        }
    }
    result
}
