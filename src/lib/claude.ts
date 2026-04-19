import Anthropic from "@anthropic-ai/sdk";
import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { TTB_GOVERNMENT_WARNING } from "@/constants/ttb";
import { buildVerificationPrompt } from "./prompt";
import type { LabelFields, VerificationResult } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT: BetaTextBlockParam = {
  type: "text",
  text:
    "You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label compliance expert. " +
    "You examine alcohol label images and verify them against application data. " +
    "Always respond with valid JSON only — no markdown, no code fences, no preamble. Output the raw JSON object directly.",
  // Cached across all batch requests — same system message every time, saves latency and cost
  cache_control: { type: "ephemeral" },
};

export async function verifyLabel(
  imageBase64: string,
  imageMediaType: "image/jpeg" | "image/png" | "image/webp",
  fields: LabelFields
): Promise<VerificationResult> {
  const start = Date.now();

  const response = await client.beta.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: [SYSTEM_PROMPT],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: buildVerificationPrompt(fields),
          },
        ],
      },
    ],
    betas: ["prompt-caching-2024-07-31"],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";

  // Strip any accidental code fences Claude might add despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: VerificationResult;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Unexpected response format from Claude. Raw output: ${raw.slice(0, 300)}`
    );
  }

  // Government warning: code-level exact match against hardcoded TTB text.
  // Claude extracts verbatim; we determine pass/fail deterministically.
  const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
  const gwField = parsed.fields?.find((f) => f.field === "government_warning");
  if (gwField) {
    const extracted = normalise(gwField.extracted_value ?? "");
    const expected = normalise(TTB_GOVERNMENT_WARNING);
    gwField.expected_value = TTB_GOVERNMENT_WARNING;
    if (!extracted) {
      gwField.status = "fail";
      gwField.explanation = "Government warning statement is missing from the label.";
    } else if (extracted === expected) {
      gwField.status = "pass";
      gwField.explanation = "";
    } else {
      gwField.status = "fail";
      const extractedLower = extracted.toLowerCase();
      const expectedLower = expected.toLowerCase();
      if (extractedLower === expectedLower) {
        gwField.explanation =
          "Government warning header capitalisation is incorrect. Required: 'GOVERNMENT WARNING:' in ALL CAPS.";
      } else {
        gwField.explanation =
          "Government warning text does not match the required TTB standard text word-for-word.";
      }
    }
  }

  // Recompute overall_status now that government_warning status is authoritative.
  const statuses = parsed.fields?.map((f) => f.status) ?? [];
  if (statuses.includes("fail")) parsed.overall_status = "fail";
  else if (statuses.includes("flag")) parsed.overall_status = "flag";
  else parsed.overall_status = "pass";

  parsed.processing_time_ms = Date.now() - start;
  return parsed;
}
