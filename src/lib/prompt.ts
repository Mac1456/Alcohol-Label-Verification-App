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

IMAGE QUALITY: If a field cannot be read clearly due to blur, glare, or angle, set status to "flag" and mention image quality in the explanation. Only apply this if genuinely unreadable — do not use image quality as an excuse for other mismatches.

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
  "overall_status": "pass" | "flag" | "fail",
  "image_quality": "good" | "poor",
  "image_quality_notes": "<notes if poor; empty string otherwise>"
}

Include one entry per checked field. Always include government_warning as the final entry.
overall_status rules: "fail" if ANY field is "fail"; "flag" if no fails but at least one "flag"; "pass" only if ALL fields pass.`;
}
