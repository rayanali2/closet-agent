import { GENERATION_ERROR, getTryOn, logMagicHourError } from "@/lib/magic-hour";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return Response.json({ error: "Invalid project." }, { status: 400 });
  try {
    return Response.json(await getTryOn(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await logMagicHourError(error);
    return Response.json({ error: GENERATION_ERROR }, { status: 502 });
  }
}
