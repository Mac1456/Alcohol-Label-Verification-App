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
| AI | Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
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

See [`PRD_alcohol_label_verification.md`](PRD_alcohol_label_verification.md) and [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md) for full context. Key decisions:

- Claude vision handles OCR, field extraction, and judgment in a single API call — no separate OCR pipeline
- Prompt caching is applied to the system message to reduce latency and cost on batch requests
- No database or persistent storage — all state is ephemeral per session
- No authentication — prototype scope per Marcus's guidance

---

## Limitations

- Large batch payloads (>300 high-resolution images) may need chunked processing for production
- Desktop layout only; no mobile optimization
- Images must be JPG, PNG, or WEBP
