import { NextRequest, NextResponse } from "next/server";
import { verifyLabel } from "@/lib/claude";
import type { LabelFields } from "@/lib/types";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export async function POST(req: NextRequest) {
  let body: { image?: string; imageType?: string; fields?: LabelFields };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { image, imageType, fields } = body;

  if (!image || !imageType || !fields) {
    return NextResponse.json(
      { error: "Request must include image (base64), imageType, and fields." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(imageType as AllowedType)) {
    return NextResponse.json(
      { error: "Unsupported image type. Accepted: JPG, PNG, WEBP." },
      { status: 400 }
    );
  }

  try {
    const result = await verifyLabel(image, imageType as AllowedType, fields);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Verification failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
