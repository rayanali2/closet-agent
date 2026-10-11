// Keep multipart requests under Vercel's 4.5 MB function payload limit.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_ERROR = "Choose a JPG or PNG photo under 4 MB.";

export function imageExtension(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.every((byte, i) => bytes[i] === byte)) return "png";
  return null;
}
