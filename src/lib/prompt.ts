import { TTB_GOVERNMENT_WARNING } from "@/constants/ttb";
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

1. brand_name: Fuzzy match. If the text matches but differs only in capitalization or punctuation (e.g. "STONE'S THROW" vs "Stone's Throw"), return status "flag" with an explanation. Only return "fail" if the brand name is genuinely different.

2. class_type: Exact match required. Any difference = "fail".

3. abv: Exact match required. Minor format differences (e.g. "45%" vs "45% Alc./Vol.") = "flag" not "fail". Substantive numeric differences = "fail".

4. net_contents: Exact match required. Any difference = "fail".

5. bottler_name: Exact match required. Any difference = "fail".

6. country_of_origin: ${hasCountryOfOrigin ? 'Exact match required. Any difference = "fail".' : "Not provided in application — skip this check entirely. Do not include it in the output."}

7. government_warning: STRICT EXACT MATCH. The label must contain word-for-word:
   "${TTB_GOVERNMENT_WARNING}"
   Requirements:
   - "GOVERNMENT WARNING:" must be in ALL CAPS
   - Every word must match exactly
   - Any deviation (title case, missing words, reordered text, truncation) = "fail"
   - If the warning is missing entirely = "fail"
   - This field is NEVER "flag" — only "pass" or "fail"

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
