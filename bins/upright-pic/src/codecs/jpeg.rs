use anyhow::{Result, ensure};
use image::{ColorType, metadata::Orientation};
use turbojpeg::{Transform, TransformOp, Transformer};

pub fn lossless(
    bytes: &[u8],
    orientation: Orientation,
    icc: Option<&[u8]>,
) -> Result<Option<Vec<u8>>> {
    use Orientation::*;
    let mut transform = Transform::op(match orientation {
        NoTransforms => TransformOp::None,
        Rotate90 => TransformOp::Rot90,
        Rotate180 => TransformOp::Rot180,
        Rotate270 => TransformOp::Rot270,
        FlipHorizontal => TransformOp::Hflip,
        FlipVertical => TransformOp::Vflip,
        Rotate90FlipH => TransformOp::Transpose,
        Rotate270FlipH => TransformOp::Transverse,
    });
    transform.perfect = true;
    transform.copy_none = true;
    let Ok(mut bytes) = Transformer::new()?.transform_to_vec(&transform, bytes) else {
        return Ok(None);
    };
    if let Some(profile) = icc {
        let mut markers = Vec::new();
        let chunks = profile.chunks(65519);
        let count = u8::try_from(chunks.len())?;
        for (i, chunk) in (1..=count).zip(chunks) {
            markers.extend_from_slice(&[0xff, 0xe2]);
            markers.extend_from_slice(&((chunk.len() + 16) as u16).to_be_bytes());
            markers.extend_from_slice(b"ICC_PROFILE\0");
            markers.extend_from_slice(&[i, count]);
            markers.extend_from_slice(chunk);
        }
        ensure!(
            bytes.starts_with(&[0xff, 0xd8]),
            "invalid lossless JPEG output"
        );
        bytes.splice(2..2, markers);
    }
    Ok(Some(bytes))
}

pub fn matches_color(profile: &[u8], color: ColorType) -> bool {
    match color {
        ColorType::L8 => profile.get(16..20) == Some(b"GRAY"),
        ColorType::Rgb8 => profile.get(16..20) == Some(b"RGB "),
        _ => false,
    }
}
