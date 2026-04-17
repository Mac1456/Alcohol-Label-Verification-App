# PRD: AI-Powered Alcohol Label Verification App
**Version:** 1.0  
**Status:** Draft  
**Audience:** Developer(s) building the prototype

---

## 1. Project Overview

The TTB (Alcohol and Tobacco Tax and Trade Bureau) reviews approximately 150,000 label applications per year with a team of 47 compliance agents. The majority of an agent's time is spent on rote verification tasks — confirming that the information printed on a label matches what was submitted in the application. This is essentially manual data-entry verification at scale.

This project is a **standalone proof-of-concept** for an AI-powered label verification tool that automates this matching process. Agents upload a label image and provide the expected application field values; the app uses AI vision to read the label and checks each field, returning a structured pass/fail/flag result per field.

The prototype is not integrated with the existing COLA system and does not persist any data. If successful, it may inform future procurement decisions.

---

## 2. Users

| User | Profile | Key Need |
|---|---|---|
| Senior agents (50+) | Low-to-moderate tech comfort | Extremely simple UI, no hidden functionality |
| Junior agents | High tech comfort | Speed and accuracy |
| IT / Evaluators | Assessing feasibility | Clean code, deployable URL, documented approach |

The UX benchmark set by the compliance director: **"My 73-year-old mother could figure it out."** Clarity and obviousness take priority over feature density.

---

## 3. Core Requirements

### 3.1 Functional Requirements

#### Single Label Verification
- Agent uploads a label image (JPG, PNG, WEBP)
- Agent enters expected field values from the application
- App returns a per-field verification result: **Pass**, **Flag**, or **Fail**
- Results are returned with an explanation for any non-passing field

#### Batch Upload
- Agent uploads multiple label images at once (up to 300)
- Each label is processed in parallel
- Results are displayed per label, with a summary view

#### Field Verification Logic
The following fields must be checked for each label:

| Field | Matching Rule |
|---|---|
| Brand Name | Fuzzy — flag case/punctuation differences, don't auto-fail. Agent makes final call. |
| Class/Type | Exact match |
| Alcohol Content (ABV) | Exact match |
| Net Contents | Exact match |
| Bottler Name & Address | Exact match |
| Country of Origin | Exact match (imports only) |
| Government Warning Statement | **Strict exact match** — see section 3.2 |

#### Judgment & Nuance
The app must not hard-fail on obvious formatting differences. Example: "STONE'S THROW" vs "Stone's Throw" should be flagged with an explanation, not auto-rejected. The agent retains final authority on all flagged fields.

### 3.2 Government Warning Statement (Critical)

The government warning check is the strictest verification in the app. It must validate:

- The label contains the exact, word-for-word standard TTB government warning text
- "GOVERNMENT WARNING:" appears in **all caps and bold**
- Any deviation (title case, missing words, reordered text, font size tricks) must result in a **Fail**, not a Flag

This check should be treated as a separate, high-priority validation step distinct from the other field checks.

### 3.3 Performance Requirement
- Single label: result returned in **≤5 seconds**
- Batch: labels processed in parallel; total time should scale sub-linearly with count
- This is a hard requirement — the previous vendor lost adoption because their system averaged 30–40 seconds per label

### 3.4 Image Quality (Stretch Goal)
- The app should attempt to read and verify labels from imperfect photographs (angled shots, glare, low lighting) rather than auto-rejecting them
- If the image quality is too poor to read a field confidently, that field should return a **Flag** with an explanation rather than crashing or rejecting the whole label

---

## 4. Tech Stack

### Frontend
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **File Uploads:** `react-dropzone` — handles drag-and-drop, multi-file, visual feedback
- **Deployment:** Vercel (free tier, satisfies the deployed URL deliverable)

### Backend
- **API Layer:** Next.js API Routes (`/app/api/...`)
  - Runs server-side Node.js; keeps API keys out of the browser
  - No separate Express or FastAPI server needed
- **Parallel Processing:** `Promise.all()` across batch label requests

### AI
- **Model:** `claude-sonnet-4-20250514` via the Anthropic SDK (`@anthropic-ai/sdk`)
- **Capabilities used:**
  - Vision: reads label image, extracts field values
  - Reasoning: applies judgment on edge cases (fuzzy matching, case differences)
  - Structured output: returns JSON per field with status + explanation

### Data
- No database
- No persistent storage
- All state is ephemeral per session (per Marcus's guidance on the prototype scope)

---

## 5. Architecture

```
Browser (Next.js Frontend)
    │
    │  POST /api/verify  { image: base64, fields: {...} }
    ▼
Next.js API Route (server-side)
    │
    │  Anthropic SDK → Claude Vision API
    ▼
Claude claude-sonnet-4-20250514
    │
    │  Returns structured JSON verification result
    ▼
Next.js API Route
    │
    │  Formats and returns response
    ▼
Browser renders per-field results
```

For batch:
```
Browser uploads N labels
    │
    ▼
Next.js API Route fans out N concurrent Claude calls via Promise.all()
    │
    ▼
Results aggregated and returned as array
```

---

## 6. Claude Prompt Design

The Claude API call should instruct the model to:

1. Read the label image and extract all visible field values
2. Compare each extracted value against the provided application data
3. Return a structured JSON object — one entry per field — with:
   - `status`: `"pass"` | `"flag"` | `"fail"`
   - `extracted_value`: what was read from the label
   - `expected_value`: what was provided in the application
   - `explanation`: human-readable reason for any non-pass result

The government warning check should be a separate, explicitly strict instruction in the prompt.

**Example response shape:**
```json
{
  "fields": [
    {
      "field": "brand_name",
      "status": "flag",
      "extracted_value": "STONE'S THROW",
      "expected_value": "Stone's Throw",
      "explanation": "Values match but casing differs. Agent review recommended."
    },
    {
      "field": "government_warning",
      "status": "fail",
      "extracted_value": "Government Warning: ...",
      "expected_value": "GOVERNMENT WARNING: ...",
      "explanation": "Warning header is not all caps. TTB requires 'GOVERNMENT WARNING:' in all caps and bold."
    }
  ],
  "overall_status": "fail",
  "image_quality": "good"
}
```

---

## 7. UI/UX Requirements

- **Single label view:** upload area, form fields for expected values, submit button, results panel
- **Batch view:** multi-file upload, progress indicator per label, summary table of results
- **Results display:** clear color coding — green (pass), yellow (flag), red (fail) — per field
- **No modals, no complex navigation, no hidden steps**
- Large click targets, high contrast, obvious primary actions
- Error states must be human-readable (not raw API errors)

---

## 8. Edge Cases to Handle

| Case | Expected Behavior |
|---|---|
| Case mismatch (e.g. "STONE'S THROW" vs "Stone's Throw") | Flag, not fail. Include explanation. |
| Government warning in title case | Hard fail |
| Government warning missing entirely | Hard fail |
| Image too blurry/angled to read a field | Flag that field, note image quality issue |
| Image unreadable entirely | Return error state with clear message |
| Batch upload with one bad image | Process remaining labels, flag the bad one |
| ABV format difference ("45%" vs "45% Alc./Vol.") | Flag, not fail — include both values |
| Missing optional field (e.g. country of origin for domestic) | Pass or skip, do not fail |

---

## 9. Out of Scope (for this prototype)

- Integration with the COLA system
- User authentication or login
- Persistent storage or audit logs
- PDF or multi-page document support
- Automated approval/rejection (agents always make the final call)
- Mobile-optimized layout (desktop agent workflow assumed)

---

## 10. Test Labels

The app needs test label images for development. Use AI image generation tools (e.g. ChatGPT, Midjourney, DALL-E) to create realistic alcohol label images covering:

- A clean, standard distilled spirits label (baseline pass case)
- A label with government warning in title case (fail case)
- A label with a brand name casing mismatch (flag case)
- A label with missing government warning entirely (fail case)
- A label photographed at an angle or with glare (stretch goal test)
- A batch set of 5–10 labels with mixed pass/flag/fail results

**Example label fields to include in generated images:**
- Brand Name: "OLD TOM DISTILLERY"
- Class/Type: "Kentucky Straight Bourbon Whiskey"
- Alcohol Content: "45% Alc./Vol. (90 Proof)"
- Net Contents: "750 mL"
- Government Warning: [Standard TTB warning text]

Reference TTB's label requirements at **ttb.gov** for exact government warning text and field specifications.

---

## 11. Deliverables Checklist

- [ ] GitHub repository with all source code
- [ ] `README.md` with setup instructions, environment variables, and how to run locally
- [ ] Brief documentation of approach, tools used, and assumptions made
- [ ] Deployed application URL (Vercel)
- [ ] Test labels used during development included in repo or documented

---

## 12. Evaluation Criteria (in priority order)

1. Correctness and completeness of core verification logic
2. Code quality and organization
3. Appropriate technical choices for the scope
4. UX clarity and error handling
5. Attention to stated requirements
6. Creative problem-solving

> **Note from the brief:** A working core application with clean code is preferred over ambitious but incomplete features. Document any trade-offs or limitations openly.

---

## 13. Environment Variables

```bash
ANTHROPIC_API_KEY=your_key_here
```

Keep this in `.env.local` (Next.js default). Never commit it to the repository. Add `.env.local` to `.gitignore`.

---

## 14. Open Questions / Assumptions

| Question | Assumption Made |
|---|---|
| How does the agent input expected field values? | Manual form entry per label in the UI |
| Does batch mode require pre-filled application data per label? | For prototype: single shared field form applies to all batch labels, or each label gets its own form — TBD based on UX complexity |
| What is the exact TTB government warning text? | Developer to confirm at ttb.gov before implementing the strict match |
| Is country of origin required for domestic labels? | No — skip this field check if not provided |
| What file types are accepted for label images? | JPG, PNG, WEBP |
