import { garments } from "@/lib/wardrobe-agent";
import { imageExtension, IMAGE_ERROR, MAX_IMAGE_BYTES } from "@/lib/image-validation";
import { createTryOn, GENERATION_ERROR, logMagicHourError } from "@/lib/magic-hour";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES + 64_000) {
      return Response.json({ error: IMAGE_ERROR }, { status: 413 });
    }
    const form = await request.formData();
    const photo = form.get("person");
    const garment = garments.find((item) => item.id === form.get("garment"));
    if (!(photo instanceof File) || !photo.size || photo.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png"].includes(photo.type)) {
      return Response.json({ error: IMAGE_ERROR }, { status: 400 });
    }
    if (!garment || form.get("garment_type") !== "upper_body") {
      return Response.json({ error: "Choose a garment from your closet." }, { status: 400 });
    }
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const extension = imageExtension(bytes);
    if (!extension || (extension === "png") !== (photo.type === "image/png")) {
      return Response.json({ error: IMAGE_ERROR }, { status: 400 });
    }
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return Response.json({ status: "complete", imageUrl: "/demo-result.jpg", demo: true });
    }
    // Create exactly once. Status requests never call this method.
    const projectId = await createTryOn(bytes, extension, garment);
    return Response.json({ status: "queued", projectId }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await logMagicHourError(error);
    return Response.json({ error: GENERATION_ERROR }, { status: 502 });
  }
}
