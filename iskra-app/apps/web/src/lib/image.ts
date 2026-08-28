/**
 * Prepares a camera photo for upload.
 *
 * A selfie taken on a recent phone is routinely 8-15MB: the 48MP main camera,
 * a Live Photo still, or a screenshot from a large display all clear the API's
 * MAX_IMAGE_SIZE_MB. Sending the original also means a long wait on venue wifi
 * and ships the photo's EXIF block, which on a phone includes the GPS
 * coordinates of wherever the picture was taken.
 *
 * Downscaling and re-encoding in the browser solves all three at once: the
 * upload lands well under the limit, it is quick, the canvas re-encode drops
 * EXIF entirely, and HEIC from an iPhone comes out the other side as JPEG.
 */

const MAX_EDGE = 1600;
const TARGET_BYTES = 1_400_000;
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];

/** Decodes to a bitmap with the EXIF orientation applied, so nothing arrives sideways. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Falls through to the <img> path, which honours orientation by default.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("This image could not be read."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Returns a JPEG under the upload budget. If the browser cannot decode the
 * file at all - desktop Chrome handed a HEIC, say - the original is returned
 * unchanged so the server, which can decode HEIC, still gets its chance.
 */
export async function prepareUploadImage(file: File): Promise<File> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    return file;
  }

  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  let blob: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    blob = await encode(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) return file;

  // Only keep the re-encode when it is genuinely an improvement; a small photo
  // that is already well compressed should not be re-encoded for nothing.
  if (blob.size >= file.size && file.type === "image/jpeg") return file;

  const name = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
