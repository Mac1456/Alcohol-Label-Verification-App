# TTB Label Verification

An AI-powered alcohol label verification tool for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance agents. Upload a label image and enter the expected application values — the app uses Claude's vision capabilities to verify each field and return a per-field pass/flag/fail result.

---

## Features

- **Single label mode** — upload one image, enter expected field values, get an instant per-field result
- **Batch mode** — upload multiple images + a CSV mapping filenames to expected values; all labels are processed in parallel
- **Judgment-based matching** — brand name differences in case/punctuation are flagged (not hard-failed) for agent review
- **Strict government warning check** — always verified against the exact TTB standard text; any deviation is a hard fail
- **Image quality handling** — poor images return a flag with an explanation rather than an error

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| File uploads | react-dropzone |
| AI | Claude (`claude-haiku-4-5-20251001`) via `@anthropic-ai/sdk` |
| Deployment | Vercel |

---

## Local Setup

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Then edit .env.local and add your Anthropic API key

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key. Never commit this. |

---

## Batch CSV Format

For batch mode, upload a CSV with this structure:

```
filename,brand_name,class_type,abv,net_contents,bottler_name,country_of_origin
label_001.jpg,Old Tom Distillery,Kentucky Straight Bourbon Whiskey,45% Alc./Vol. (90 Proof),750 mL,Old Tom Distillery Co. - Bardstown KY,USA
label_002.jpg,Stone's Throw,American Whiskey,40% Alc./Vol. (80 Proof),1L,Stone's Throw Spirits - Portland OR,
```

- `country_of_origin` can be left blank for domestic labels
- `government_warning` is not a CSV column — it is always checked against the hardcoded TTB standard text
- If a CSV filename doesn't match an uploaded image (or vice versa), the error is surfaced per-label in the results

---

## Field Verification Rules

Each field has its own matching rule. The rules are enforced by the prompt Claude receives on every verification call.

| Field | Match Type | Pass | Flag | Fail | Notes |
|---|---|---|---|---|---|
| **Brand Name** | Content match with capitalisation sensitivity | Identical content and capitalisation | Same content, any capitalisation difference (e.g. `OLD TOM DISTILLERY` vs `Old Tom Distillery`) — always flagged for agent review regardless of which side is uppercase | Substantively different content | An exact match (content + capitalisation) always returns pass; a same-content casing difference always returns flag, never pass |
| **Class / Type** | Exact | Identical after line-break normalization | — | Any difference | Multi-line / word-wrapped text on the label is concatenated before comparison; line breaks are a layout artifact, not a content difference |
| **Alcohol Content (ABV)** | Exact (numeric); lenient (format) | Identical | Format-only difference, e.g. `45%` vs `45% Alc./Vol.` | Numeric value differs | Only the number matters for a fail; formatting differences get a flag for agent review |
| **Net Contents** | Exact | Identical | — | Any difference | No leniency |
| **Bottler Name & Address** | Exact | Identical after line-break normalization | — | Any difference | Same line-break normalization as Class / Type; common on labels where the address wraps across lines |
| **Country of Origin** | Exact (if provided) | Identical | — | Any difference | Skipped entirely if blank — domestic labels are not penalized for a missing import field |
| **Government Warning** | Two independent components, both must pass | Header is `GOVERNMENT WARNING:` in ALL CAPS **and** body is word-for-word exact | *(never flagged)* | Header not ALL CAPS (e.g. `Government Warning:`), OR body deviates in any way, OR warning absent — each is a standalone hard fail | Checked as two independent gates. Correct body with wrong header capitalisation = fail. Correct header with wrong body = fail. No partial credit. The TTB ABLA 1988 text is hardcoded server-side; agents never enter it. |

### Status definitions

- **Pass** — field on the label matches the application data within the tolerance defined above
- **Flag** — a difference exists but may be a transcription or formatting variation; requires agent review before a determination is made
- **Fail** — a definitive mismatch; the label does not comply with the application data
- **Overall status** follows a strict hierarchy: `fail` if any field fails; `flag` if no fails but at least one flag; `pass` only if all fields pass

---

## API Reference

### `POST /api/verify` — Single label

**Request body (JSON):**
```json
{
  "image": "<base64-encoded image>",
  "imageType": "image/jpeg",
  "fields": {
    "brand_name": "Old Tom Distillery",
    "class_type": "Kentucky Straight Bourbon Whiskey",
    "abv": "45% Alc./Vol. (90 Proof)",
    "net_contents": "750 mL",
    "bottler_name": "Old Tom Distillery Co. - Bardstown KY",
    "country_of_origin": "USA"
  }
}
```

**Response:**
```json
{
  "fields": [
    {
      "field": "brand_name",
      "status": "pass",
      "extracted_value": "Old Tom Distillery",
      "expected_value": "Old Tom Distillery",
      "explanation": ""
    }
  ],
  "overall_status": "pass",
  "image_quality": "good",
  "image_quality_notes": "",
  "processing_time_ms": 2100
}
```

### `POST /api/verify-batch` — Batch

**Request:** `multipart/form-data`
- `csv` — the CSV file
- `image_<filename>` — one entry per image (key is `image_` + original filename)

**Response:**
```json
{
  "results": [
    {
      "filename": "label_001.jpg",
      "status": "pass",
      "result": { ... }
    }
  ],
  "summary": {
    "total": 5,
    "passed": 3,
    "flagged": 1,
    "failed": 1,
    "errored": 0
  }
}
```

---

## Approach & Assumptions

See [`docs/PRD_alcohol_label_verification.md`](docs/PRD_alcohol_label_verification.md) and [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md) for full context. Key architectural decisions:

- Claude vision handles OCR, field extraction, and judgment in a single API call — no separate OCR pipeline
- Prompt caching is applied to the system message to reduce latency and cost on batch requests
- No database or persistent storage — all state is ephemeral per session
- No authentication — prototype scope; no sensitive data is stored or persisted between sessions

### Field-level assumptions

The project brief was silent or ambiguous on several field-specific matching rules. The following decisions were made explicitly:

**Bottler Name & Address**
The brief does not define exact formatting rules. The app treats this as an exact match after line-break normalisation — text that wraps across multiple lines on the label is concatenated into a single string before comparison. Additionally, prefixes commonly printed on labels such as "Bottled by" or "Distributed by" are ignored — only the name and address are compared against the application data.

**Country of Origin**
The brief specifies this field is required for imports only. A blank country of origin field is treated as "not applicable" and the check is skipped entirely. A blank value will never produce a fail or flag. This applies equally to the single-label form and the batch CSV.

**Government Warning**
The warning text is always hardcoded from the Alcoholic Beverage Labeling Act of 1988 — never sourced from the CSV or entered manually by the agent. The check has two independent components that must both pass: (1) the header must appear as `GOVERNMENT WARNING:` in ALL CAPS, and (2) the body text must be word-for-word exact. Failing either component returns a hard fail. This field can never return FLAG — only PASS or FAIL.

**Brand Name**
Casing differences between the label and application data always return FLAG, never PASS or FAIL, so the agent makes the final determination. Identical values (same content and same capitalisation) always return PASS.

**Class / Type**
Line breaks and word wrapping on the label are ignored. The field text is concatenated into a single string before comparison.

**Batch Mode**
The government warning is never included in the CSV — it is always checked against the hardcoded TTB standard text. A blank country of origin column is treated identically to a blank form field — the check is skipped. If a filename in the CSV does not match an uploaded image, or an uploaded image has no corresponding CSV row, that label surfaces a clear per-label error rather than being silently skipped or causing the batch to abort.

---

## Limitations

- Large batch payloads (>300 high-resolution images) may need chunked processing for production
- Desktop layout only; no mobile optimization
- Accepted image formats: JPG, PNG, and WEBP only
