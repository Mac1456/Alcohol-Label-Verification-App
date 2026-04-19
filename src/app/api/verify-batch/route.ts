import { NextRequest, NextResponse } from "next/server";
import { verifyLabel } from "@/lib/claude";
import { parseCSV } from "@/lib/parse-csv";
import type { BatchLabelResult, BatchVerificationResponse } from "@/lib/types";

export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function mediaTypeFromFilename(filename: string): AllowedType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not parse request. Send multipart/form-data." },
      { status: 400 }
    );
  }

  const csvFile = formData.get("csv");
  if (!csvFile || typeof csvFile === "string") {
    return NextResponse.json(
      { error: "Missing CSV file. Include a 'csv' field in the form data." },
      { status: 400 }
    );
  }

  const csvText = await (csvFile as File).text();
  let records;
  try {
    records = parseCSV(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "CSV parse error.";
    return NextResponse.json({ error: `CSV error: ${message}` }, { status: 400 });
  }

  // Build filename → File map from all uploaded images
  const imageMap = new Map<string, File>();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("image_") && typeof value !== "string") {
      const file = value as File;
      imageMap.set(file.name, file);
    }
  }

  // Find images with no matching CSV row
  const csvFilenames = new Set(records.map((r) => r.filename));
  const extraImages = [...imageMap.keys()].filter((n) => !csvFilenames.has(n));

  // Process every CSV row in parallel
  const labelPromises = records.map(async (record): Promise<BatchLabelResult> => {
    const { filename, ...fields } = record;

    const imageFile = imageMap.get(filename);
    if (!imageFile) {
      return {
        filename,
        status: "error",
        error: "Listed in CSV but no matching image was uploaded.",
      };
    }

    const mediaType = mediaTypeFromFilename(filename);
    if (!mediaType) {
      return {
        filename,
        status: "error",
        error: "Unsupported image format. Use JPG, PNG, or WEBP.",
      };
    }

    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const result = await verifyLabel(base64, mediaType, fields);
      return { filename, status: result.overall_status, result };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed.";
      return { filename, status: "error", error: message };
    }
  });

  const results = await Promise.all(labelPromises);

  // Append entries for images that were uploaded but have no CSV row
  for (const name of extraImages) {
    results.push({
      filename: name,
      status: "error",
      error: "Image uploaded but no matching row found in CSV.",
    });
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    flagged: results.filter((r) => r.status === "flag").length,
    failed: results.filter((r) => r.status === "fail").length,
    errored: results.filter((r) => r.status === "error").length,
  };

  const response: BatchVerificationResponse = { results, summary };
  return NextResponse.json(response);
}
