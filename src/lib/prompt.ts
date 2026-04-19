import type { LabelFields } from "./types";

export function buildVerificationPrompt(fields: LabelFields): string {
  const fieldLines = (
    Object.entries(fields) as [keyof LabelFields, string | undefined][]
  )
    .filter(([, v]) => v && v.trim() !== "")
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const hasCountryOfOrigin = Boolean(fields.country_of_origin?.trim());

  return `Verify this alcohol label image against the following application data.

APPLICATION DATA:
${fieldLines || "  (no fields provided)"}

VERIFICATION RULES — apply exactly as specified:

1. brand_name: Content match with capitalization sensitivity. Rules in priority order:
   - If the extracted value and expected value are character-for-character identical (same content, same capitalization), return "pass".
   - If the text content matches but the capitalization differs in any way (e.g. "OLD TOM DISTILLERY" vs "Old Tom Distillery"), return "flag" with an explanation noting the specific casing difference and recommending agent review. This applies regardless of which side is uppercase — any capitalization mismatch is a flag, always.
   - If the brand name content is substantively different, return "fail".

2. class_type: Exact match required. Before comparing, concatenate any multi-line or word-wrapped text on the label into a single string — line breaks and word wrap are a label layout artifact, not a content difference. Any difference after concatenation = "fail".

3. abv: Exact match required. Minor format differences (e.g. "45%" vs "45% Alc./Vol.") = "flag" not "fail". Substantive numeric differences = "fail".

4. net_contents: Exact match required. Any difference = "fail".

5. bottler_name: Exact match required. Before comparing: (a) concatenate any multi-line or word-wrapped text into a single string — line breaks are a layout artifact; (b) strip any leading label prefix such as "Bottled by", "Distributed by", "Produced by", "Imported by", or similar — only the name and address are compared against the application data. Any difference after these normalisation steps = "fail".

6. country_of_origin: ${hasCountryOfOrigin ? 'Exact match required. Any difference = "fail".' : "Not provided in application — skip this check entirely. Do not include it in the output."}

7. government_warning: Extract the government warning text exactly as it appears on the label — verbatim, preserving the exact capitalisation and every word as printed. Include the header and the full body text. Do not evaluate, compare, or judge the text — just transcribe what you see. If no government warning is visible, set extracted_value to an empty string. Set status to "pass" as a placeholder — the actual pass/fail determination is made separately in code.

IMAGE QUALITY HANDLING:

Always make your best effort to read the label regardless of image imperfections (glare, angle, low lighting, blur). Do not refuse to process an imperfect image. Apply the following rules:

- If you can read a field despite imperfections, verify it normally and report any mismatch.
- If a specific field is affected by image quality and you cannot read it with confidence, set that field's status to "flag" and write a specific explanation naming the quality issue and which part of the label it affected — e.g. "Glare obscured the lower half of the label; the net contents field could not be read with confidence." Do not use image quality as an excuse for a mismatch you can clearly see.
- If the image is so severely degraded that no fields can be read at all (completely dark, totally blurred, pure glare, image corrupted), set image_quality to "unreadable", set overall_status to "error", set image_quality_notes to a specific description of why the image is unreadable, and return an empty fields array. Do not attempt field-by-field results for a completely unreadable image.

Set image_quality to:
- "good" — image is clear and all fields readable
- "poor" — image has quality issues but some or all fields could still be read
- "unreadable" — image is too degraded for any field extraction

Respond with ONLY valid JSON — no markdown, no code fences, no explanation. Use this exact schema:

{
  "fields": [
    {
      "field": "<field_name>",
      "status": "pass" | "flag" | "fail",
      "extracted_value": "<text read from the label>",
      "expected_value": "<value from application data>",
      "explanation": "<reason for non-pass result; empty string for pass>"
    }
  ],
  "overall_status": "pass" | "flag" | "fail" | "error",
  "image_quality": "good" | "poor" | "unreadable",
  "image_quality_notes": "<specific description of quality issues observed; empty string if good>"
}

Include one entry per checked field. Always include government_warning as the final entry unless image_quality is "unreadable".
overall_status rules: "fail" if ANY field is "fail"; "flag" if no fails but at least one "flag"; "pass" only if ALL fields pass; "error" only if image_quality is "unreadable".`;
}
