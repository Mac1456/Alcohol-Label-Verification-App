import Anthropic from "@anthropic-ai/sdk";
import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
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
    model: "claude-sonnet-4-6",
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

  parsed.processing_time_ms = Date.now() - start;
  return parsed;
}
