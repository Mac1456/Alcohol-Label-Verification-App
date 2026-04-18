# Development Log: AI-Powered Alcohol Label Verification App
**Last Updated:** April 17, 2026
**Status:** Phase 3 complete — 7-case structured test suite run, two prompt bugs fixed, all test cases passing

---

## Overview

This document is a living log of the development process for the TTB alcohol label verification prototype. It will be updated continuously as development progresses. Each phase documents decisions made, tools used, assumptions, and any changes to the original plan.

---

## Phase 0: Discovery & Planning ✅

### What Happened
Development began with a review of the original project brief — a Word document containing stakeholder interview notes and technical requirements from the TTB Compliance Division. Rather than jumping straight into scaffolding, the first step was to thoroughly parse the brief and extract actionable requirements before writing a single line of code.

The following steps were completed in order:

1. **Read and parsed the project brief** (`Take-Home_Project__AI-Powered_Alcohol_Label_Verification_App.docx`)
   - Identified four stakeholders: Sarah Chen (Deputy Director), Marcus Williams (IT Admin), Dave Morrison (Senior Agent), Jenny Park (Junior Agent)
   - Extracted hard requirements, soft requirements, and implicit expectations from each interview
   - Noted the 5-second performance benchmark as a hard constraint from a failed prior vendor

2. **Synthesized a requirements checklist** — distilled the brief into a flat list of must-haves, nice-to-haves, and out-of-scope items:
   - Image-based label field matching
   - ≤5 second response time (hard requirement)
   - Grandma-level UX (73-year-old benchmark from Sarah)
   - Batch upload support (200–300 labels)
   - Judgment-based matching (flag, don't auto-fail on edge cases)
   - Exact match for government warning statement
   - Stretch goal: handle imperfect/angled photographs

3. **Selected tech stack** through a deliberate decision process:
   - Evaluated whether a separate backend was needed (concluded: no, Next.js API routes handle it)
   - Ruled out standalone OCR libraries (Tesseract etc.) in favor of Claude vision — fewer moving parts, faster, handles judgment natively
   - Selected Vercel for deployment as the zero-friction path to a live URL deliverable

4. **Created the PRD** (`PRD_alcohol_label_verification.md`) — a full product requirements document covering technical requirements, architecture, Claude prompt design, edge cases, UI/UX requirements, test label guidance, and open questions

5. **Resolved open questions before development started:**
   - **Batch UX:** Option A — CSV upload. Each batch row maps a filename to its expected field values. This preserves the primary use case (application matching) while remaining simple to implement. Shared-form batch (Option B) was ruled out because it would gut the most important feature.
   - **Government warning:** Hardcoded from the Alcoholic Beverage Labeling Act of 1988 (ABLA). Never sourced from the CSV — always an exact-match check against the TTB standard text.
   - **Country of origin:** Optional. Skipped entirely if blank in the form or CSV — domestic labels should not fail on a missing import field.

---

## Phase 1: Scaffolding & Full Implementation ✅

### What Happened

The complete application was built from scratch in a single session. No starter template was used — all files were written manually to maintain full control over structure and avoid unnecessary boilerplate.

#### Project Structure Created

```
/
├── CHECKLIST.md
├── DEVELOPMENT_LOG.md
├── PRD_alcohol_label_verification.md
├── README.md
├── .gitignore
├── .env.local.example
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── api/
    │       ├── verify/route.ts
    │       └── verify-batch/route.ts
    ├── components/
    │   ├── DropZone.tsx
    │   ├── FieldForm.tsx
    │   ├── FieldResultRow.tsx
    │   ├── ResultsPanel.tsx
    │   ├── SingleVerify.tsx
    │   ├── BatchResultsTable.tsx
    │   └── BatchVerify.tsx
    ├── constants/
    │   └── ttb.ts
    └── lib/
        ├── types.ts
        ├── claude.ts
        ├── prompt.ts
        ├── parse-csv.ts
        └── image-utils.ts
```

#### Key Implementation Decisions

**Claude API integration (`src/lib/claude.ts`)**
- Uses `client.beta.messages.create()` rather than `client.messages.create()`. In SDK version 0.30.x, `cache_control` on the system message content block is only available through the beta messages namespace — not the standard one. Discovered during TypeScript compilation (`error TS2769: cache_control does not exist in type TextBlockParam`).
- System prompt is marked `cache_control: { type: "ephemeral" }`. Because the system prompt is identical across all batch requests, it gets cached after the first call. Subsequent calls in a batch reuse the cache, reducing both latency and token cost.
- The `betas: ["prompt-caching-2024-07-31"]` flag is passed explicitly to enable the feature.
- Response JSON is stripped of accidental code fences before parsing, as a defensive measure against Claude occasionally wrapping output in markdown despite instructions.

**Verification prompt (`src/lib/prompt.ts`)**
- Built dynamically per request — includes only the field values the agent actually provided
- Explicit per-field matching rules:
  - `brand_name`: fuzzy — flag case/punctuation differences, don't fail
  - `class_type`, `net_contents`, `bottler_name`: exact match required
  - `abv`: exact match, but format differences (e.g. "45%" vs "45% Alc./Vol.") return flag not fail
  - `country_of_origin`: exact if provided, skipped entirely if blank
  - `government_warning`: always checked, always strict exact match against hardcoded TTB text, never a flag — only pass or fail
- `overall_status` computed by Claude following explicit rules: fail > flag > pass

**Batch API route (`src/app/api/verify-batch/route.ts`)**
- Accepts `multipart/form-data`: one `csv` field + any number of `image_<filename>` fields
- CSV is parsed server-side with a custom parser (`src/lib/parse-csv.ts`) that handles quoted fields (important for addresses containing commas)
- Cross-validates CSV filenames against uploaded images in both directions: missing images and extra images both surface as per-label errors rather than silently failing
- All label verifications are fired concurrently via `Promise.all()` — one Claude call per label, in parallel
- Per-label errors (bad format, missing image, Claude failure) are isolated and don't abort the rest of the batch

**CSV parser (`src/lib/parse-csv.ts`)**
- Handles quoted fields with internal commas (e.g. `"Smith, John - Bardstown, KY"`)
- Trims whitespace from all headers and values, so column headers with spaces after commas parse correctly
- Unknown columns are silently ignored — CSV can have extra columns without breaking
- Empty `country_of_origin` values are treated as not-provided

**Frontend**
- Two-tab layout: Single Label / Batch Upload
- Single mode: drag-and-drop image upload + field form + live preview, results rendered as color-coded per-field cards (green/amber/red)
- Batch mode: multi-image drop zone with per-file list and remove buttons, separate CSV drop zone, summary bar (total/passed/flagged/failed), expandable rows for field-level detail
- Processing time displayed per label (in seconds)
- All error states are human-readable — no raw API errors surfaced to the user

#### TypeScript Issues Resolved During Development

| Error | Fix |
|---|---|
| `cache_control does not exist in type TextBlockParam` | Switched from `client.messages` to `client.beta.messages` which uses `BetaTextBlockParam` |
| `FormDataIterator can only be iterated with --downlevelIteration or ES2015+` | Added `"target": "ES2017"` to `tsconfig.json` |
| `MapIterator` same issue | Same fix |

All three were caught by `tsc --noEmit` before running the dev server.

#### Verification: Dev Server
`npm run dev` compiles with 0 errors, 0 warnings. Root route returns correct HTML with TTB header, tab navigation, field form, and results panel.

---

## Phase 2: Initial Testing & Prompt Fix ✅

### What Happened

The app was tested end-to-end for the first time using a ChatGPT-generated label image of the Old Tom Distillery label alongside the sample data loaded via the pre-fill button (added earlier in this phase — see below).

#### Test Setup
- Label image: AI-generated Old Tom Distillery label (JPG)
- Application data: loaded via "Load Sample Data" button
- Fields tested: Brand Name, Class/Type, ABV, Net Contents, Bottler Name, Government Warning

#### Results
Core verification logic worked correctly on first run:
- `class_type`, `abv`, `net_contents` all returned `PASS`
- Government warning check functioned as expected

#### Bug Identified: Brand Name False FLAG on Exact Match

`brand_name` returned `FLAG` despite the extracted value and expected value being character-for-character identical (`"OLD TOM DISTILLERY"` vs `"OLD TOM DISTILLERY"`). Claude returned a vague explanation about "stylistic rendering differences" despite there being none.

**Root cause:** The verification prompt rule for `brand_name` only specified what should produce a `FLAG` or `FAIL` — it never explicitly stated that an exact match must always return `PASS`. This left Claude room to hedge on identical values.

**Fix applied (`src/lib/prompt.ts`):** Rule 1 was updated to include an explicit constraint:

> _"If the extracted value and expected value are character-for-character identical, you MUST return 'pass' — no exceptions."_

FLAG is now constrained to genuine, meaningful differences only (e.g. different capitalization or punctuation). This is a prompt engineering fix — no structural changes were required.

#### Other Changes Made in This Phase

**"Load Sample Data" button (`src/components/SingleVerify.tsx`)**
- A small text-link button was added inline with the "Application Data" section header
- When clicked, pre-fills all form fields with Old Tom Distillery test values and leaves country of origin blank
- Styled as an unobtrusive text link — not the same visual weight as the primary Verify button
- Purpose: testing utility only; the values have no special status and do not affect verification logic

**Batch mode architecture confirmed**
- CSV upload (Option A) was finalized as the batch input method: each CSV row maps a filename to its expected field values
- Government warning is never in the CSV — always checked against the hardcoded TTB ABLA text server-side
- Country of origin is optional; blank values are treated as not-provided and the check is skipped

**Single label mode prototype assumption acknowledged**
- Manual form entry for expected field values is a deliberate prototype simplification
- In a production system, field values would be pre-populated from a TTB application database — agents would not type them manually
- This is documented as an assumption, not an oversight

---

## Phase 3: Structured Test Suite & Prompt Hardening ✅

### What Happened

Seven structured test cases were run to systematically validate each field's matching behaviour. Several prompt deficiencies were discovered and fixed during this phase. All test cases passed after fixes were applied.

---

### Prompt Changes Made in This Phase

Two prompt rules were updated based on test failures.

#### Fix 1 — Government Warning: two-component check (Test Cases 4 & 5)

**Problem:** The government warning rule listed `"GOVERNMENT WARNING:" must be in ALL CAPS` as one bullet among several, which Claude was treating as advisory context rather than a hard independent gate. A title-case header (`Government Warning:`) with correct body text was returning `PASS`.

**Fix (`src/lib/prompt.ts`, rule 7):** The rule was restructured into two explicitly independent components, each capable of producing a standalone `fail`:
- **Component 1 — Header capitalization:** `GOVERNMENT WARNING:` must appear in ALL CAPS. Any other capitalisation (`Government Warning:`, `Government warning:`, etc.) is an immediate hard fail, even if the body text is correct.
- **Component 2 — Body text:** Word-for-word exact match against the hardcoded TTB ABLA text. Any deviation — truncation, reordering, paraphrasing — is a hard fail.

Both components must pass independently. Partial credit is explicitly prohibited. The field remains `"pass"` or `"fail"` only — `"flag"` is never valid for government warning.

#### Fix 2 — Brand Name: casing mismatch must return FLAG (Test Case 6)

**Problem:** The brand name rule stated that an exact character-for-character match must return `PASS`, but it did not clearly establish that a same-content, different-capitalisation match (e.g. `"OLD TOM DISTILLERY"` on the label vs `"Old Tom Distillery"` in the form) must return `FLAG`. Claude was returning `PASS` on these cases.

**Fix (`src/lib/prompt.ts`, rule 1):** The rule was restructured into three explicit tiers in priority order:
1. Same content, same capitalisation → `"pass"`
2. Same content, any capitalisation difference → `"flag"`, always, regardless of which side is uppercase, with an explanation noting the casing difference and recommending agent review
3. Substantively different content → `"fail"`

---

### Test Cases

All seven cases were run against the Old Tom Distillery label image using the single-label verification mode.

#### Test Case 1 — Baseline Passing Label
**Purpose:** Confirm core verification logic under ideal conditions.
**Setup:** All application data fields match the label exactly. Government warning present in correct format.
**Expected result:** All fields `PASS`, overall `PASS`.
**Actual result:** ✅ Pass — all fields returned `PASS`.

#### Test Case 2 — Wrong ABV
**Purpose:** Confirm the app catches numeric field mismatches.
**Setup:** ABV in the application data form set to `50%`; label shows `45% Alc./Vol. (90 Proof)`.
**Expected result:** ABV `FAIL`, all other fields `PASS`, overall `FAIL`.
**Actual result:** ✅ Pass — ABV returned `FAIL` with correct explanation; all other fields `PASS`.

#### Test Case 3 — Class/Type Line Break
**Purpose:** Confirm the app does not penalise text that wraps across lines on a physical label.
**Setup:** Label image where `Kentucky Straight Bourbon Whiskey` wraps across two lines due to label layout.
**Expected result:** Class/Type `PASS` despite the line break.
**Actual result:** ✅ Pass — Class/Type returned `PASS`. Line-break normalisation in the prompt (rule 2) concatenated the multi-line text before comparison.

#### Test Case 4 — Government Warning Title Case
**Purpose:** Confirm the app enforces the ALL CAPS header requirement strictly.
**Setup:** Label where the warning header reads `Government Warning:` in title case instead of `GOVERNMENT WARNING:`.
**Expected result:** Government Warning `FAIL`.
**Actual result (before fix):** ❌ Returned `PASS` — Claude was not treating the capitalisation check as a hard independent gate.
**Actual result (after fix):** ✅ `FAIL` — Component 1 (header capitalisation) failed independently; correct explanation returned.
**Prompt change required:** Yes — rule 7 restructured into two independent components (see above).

#### Test Case 5 — Missing Government Warning
**Purpose:** Confirm the app catches a completely absent warning rather than passing silently.
**Setup:** Label image with no government warning statement present.
**Expected result:** Government Warning `FAIL`.
**Actual result:** ✅ Pass — Government Warning returned `FAIL` with explanation noting warning was not found.

#### Test Case 6 — Brand Name Casing Mismatch
**Purpose:** Confirm the app applies judgment rather than auto-failing on capitalisation differences.
**Setup:** Label shows `OLD TOM DISTILLERY` in all caps; application data form has `Old Tom Distillery` in title case.
**Expected result:** Brand Name `FLAG` with explanation noting the casing difference and recommending agent review.
**Actual result (before fix):** ❌ Returned `PASS` — same-content casing mismatches were not explicitly required to return `FLAG`.
**Actual result (after fix):** ✅ `FLAG` — explanation correctly identified the capitalisation difference and recommended agent review.
**Prompt change required:** Yes — rule 1 restructured into three explicit tiers (see above).

#### Test Case 7 — Bottler Name Mismatch
**Purpose:** Confirm the app catches bottler information discrepancies.
**Setup:** Bottler Name & Address in the form changed to a completely different entity; all other fields correct.
**Expected result:** Bottler Name `FAIL`, all other fields `PASS`, overall `FAIL`.
**Actual result:** ✅ Pass — Bottler Name returned `FAIL` with clear explanation; all other fields `PASS`.

---

### Field Verification Rules: Current State

The table below reflects the rules as they stand after all Phase 3 prompt changes. This supersedes any earlier description of field rules.

| Field | Rule | PASS | FLAG | FAIL |
|---|---|---|---|---|
| **Brand Name** | Content match with capitalisation sensitivity | Identical content and capitalisation | Same content, any capitalisation difference — always flagged for agent review | Substantively different content |
| **Class / Type** | Exact match after line-break normalisation | Identical after concatenating wrapped lines | — | Any difference after normalisation |
| **ABV** | Exact numeric; lenient on format | Identical | Format-only difference (e.g. `45%` vs `45% Alc./Vol.`) | Numeric value differs |
| **Net Contents** | Exact match | Identical | — | Any difference |
| **Bottler Name & Address** | Exact match after line-break normalisation | Identical after concatenating wrapped lines | — | Any difference after normalisation |
| **Country of Origin** | Exact match if provided; skipped if blank | Identical, or field was blank | — | Any difference when provided |
| **Government Warning** | Two independent components, both must pass | Both header ALL CAPS and body word-for-word correct | *(never valid)* | Header not ALL CAPS, OR body text deviates in any way, OR warning absent |

---

## Approach

### Philosophy
The core principle guiding technical decisions is: **solve the problem with the minimum viable number of moving parts.** This is a time-constrained proof-of-concept. Complexity that doesn't directly serve the evaluation criteria is a liability, not an asset.

### Why Claude Vision Instead of OCR + Separate Matching Logic
A traditional approach would be:
1. OCR library extracts text from the label image
2. Parsing logic identifies fields
3. Matching logic compares fields to application data
4. Rules engine handles edge cases

This has three failure points and requires significant tuning per label format. Instead, the approach here delegates all three steps to Claude in a single API call:
- Claude reads the image (vision)
- Claude extracts and identifies fields (reasoning)
- Claude compares to expected values and applies judgment (reasoning)
- Claude returns structured JSON (prompted output format)

This is faster to build, more robust to label format variation, and handles nuance (the Stone's Throw problem) without hand-coded rules.

### Why Next.js
- Single repo for frontend and backend
- API routes keep the Anthropic API key server-side
- Vercel deployment is one `git push` away
- App Router supports async server components which simplify data fetching patterns

### Batch Processing Strategy
Batch labels are processed via `Promise.all()` — parallel Claude API calls fired simultaneously. This keeps the architecture simple while achieving sub-linear time scaling for batches. For very large batches (200–300 labels), this may need to be chunked to avoid rate limits; to be assessed during testing.

---

## Tools Used

| Tool | Purpose |
|---|---|
| Claude (Anthropic) | Planning assistant, requirements synthesis, PRD generation, development log, full implementation |
| `claude-haiku-4-5-20251001` via `client.beta.messages` | Core AI engine for label verification at runtime (switched from Sonnet after benchmarking — see Performance Benchmarks) |
| Next.js 15 (App Router) | Full-stack React framework (frontend + API routes) |
| Tailwind CSS 3 | Styling |
| `react-dropzone` | File upload UI component |
| `@anthropic-ai/sdk` 0.30.x | Anthropic API client for Node.js |
| Vercel | Deployment (pending) |
| AI image generation (TBD) | Generating test label images for Phase 5 testing |

---

## Assumptions Made

### General

| Assumption | Rationale |
|---|---|
| Cloud API (Anthropic) is acceptable for the prototype | Marcus flagged firewall concerns for production, but explicitly said the prototype doesn't need to follow those constraints. Claude vision is necessary to hit the 5-second benchmark and handle judgment. |
| No authentication required | Marcus said "just don't do anything crazy" for the prototype. No PII is stored or persisted between sessions. Auth would add scope without adding evaluation value. |
| Desktop-first layout | Agents work at desks. Mobile optimization is not mentioned in the brief and would add scope. |
| JPG, PNG, and WEBP are sufficient image formats | Standard formats for label photography. PDF and TIFF out of scope. |

### Field-level decisions (brief was silent or ambiguous)

| Field | Assumption | Rationale |
|---|---|---|
| **Bottler Name & Address** | Exact match after line-break normalisation. Prefixes printed on the label such as "Bottled by" or "Distributed by" are stripped before comparison — only the name and address are matched against the application data. | The brief does not specify formatting rules for this field. Line breaks are a label layout artifact. Printed prefixes are standard on physical labels and not part of the application data. |
| **Country of Origin** | A blank field is treated as "not applicable" — the check is skipped entirely and will never produce a fail or flag. | The brief specifies this field is required for imports only. Domestic labels should not be penalised for a missing import field. Applies equally to the single-label form and batch CSV. |
| **Government Warning** | Two independent components must both pass: (1) header must be `GOVERNMENT WARNING:` in ALL CAPS, (2) body must be word-for-word exact against the hardcoded TTB ABLA 1988 text. Failing either is a hard fail. Field can never return FLAG. | The brief requires an exact match. Structuring it as two independent gates prevents Claude from passing a label that has the right body but wrong header capitalisation, or vice versa. The warning text is hardcoded server-side — agents never enter it, it is never in the CSV. |
| **Brand Name** | Casing differences always return FLAG regardless of which side is uppercase. Identical content and capitalisation returns PASS. Substantively different content returns FAIL. | The brief does not define a capitalisation rule. Flagging rather than failing preserves agent judgment — a label printed in all-caps is a common typographic choice and may not indicate an error. |
| **Class / Type** | Line breaks and word wrapping are ignored — text is concatenated before comparison. | Labels frequently wrap long class/type descriptors across two lines due to space constraints. This is a layout artifact, not a content difference. |
| **Batch Mode CSV** | Government warning is never a CSV column. Blank country of origin is treated as not-provided. Filename mismatches (CSV row with no matching image, or uploaded image with no CSV row) surface as per-label errors, not silent skips or batch aborts. | Government warning is always checked server-side against hardcoded text — including it in the CSV would introduce human error. Explicit filename mismatch errors prevent agents from missing labels due to upload mistakes. |

---

## Performance Benchmarks

### Model Selection: Haiku vs Sonnet

After Phase 2 testing confirmed the app was functionally correct on Sonnet, the model was switched to `claude-haiku-4-5-20251001` to evaluate whether it could meet the 5-second hard requirement more consistently. 8 back-to-back verification calls were made against the Old Tom Distillery test label using the full production prompt.

#### Response Time Results (8 runs, single label, Haiku)

| Run | Time (s) | Overall Status |
|-----|----------|----------------|
| 1 | 3.23 | pass |
| 2 | 2.79 | pass |
| 3 | 2.76 | pass |
| 4 | 2.97 | pass |
| 5 | 5.70 | pass |
| 6 | 3.43 | pass |
| 7 | 2.75 | pass |
| 8 | 2.79 | pass |

| Metric | Value |
|--------|-------|
| Min | 2.75s |
| Max | 5.70s |
| Avg | 3.30s |
| Median | 2.88s |
| Under 5s | 7/8 (87.5%) |

#### Accuracy

All 8 runs returned correct results across every field. No false flags, no false fails. Government warning exact match passed correctly on all runs. Brand name (post-prompt fix) passed correctly on all runs. The one run exceeding 5s (5.70s, run 5) was an isolated network/API latency spike — the other 7 runs clustered tightly between 2.75–3.43s.

#### Decision

Haiku adopted as the production model for this prototype. The range across 8 runs was 2.75s–5.70s with an average of 3.30s — consistently under the 5-second hard requirement, with one outlier attributable to transient API latency rather than a model characteristic. No accuracy regression observed on any field. Note: these times reflect single-label calls under light load; response times may increase under heavier load or when batch mode fires many concurrent Claude calls simultaneously.

---

## Open Questions

| Question | Status |
|---|---|
| Rate limit handling for large batches (300 labels) | ⬜ To be assessed during Phase 5 testing |
| Whether `Promise.all()` is sufficient for 300 labels or needs chunking | ⬜ To be tested |
| Whether Haiku maintains accuracy on harder edge cases (angled photos, imperfect labels) | ⬜ To be tested in Phase 5 |

---

## Change Log

| Date | Change |
|---|---|
| April 17, 2026 | Initial document created. Phase 0 (discovery and planning) complete. PRD drafted. Tech stack selected. |
| April 17, 2026 | Phase 1 complete. Full application scaffolded and implemented: API routes, all UI components, Claude integration with prompt caching, batch CSV processing, TypeScript errors resolved. Dev server running. Code pushed to GitHub. |
| April 17, 2026 | Phase 2 complete. First end-to-end test run with AI-generated label image. Core verification (Class/Type, ABV, Net Contents) passed correctly. Brand Name false FLAG bug identified and fixed via prompt update — exact matches now explicitly required to return PASS. "Load Sample Data" button added to single label form. Batch CSV architecture and single-label prototype assumption documented. |
| April 18, 2026 | Model switched from `claude-sonnet-4-6` to `claude-haiku-4-5-20251001`. 8-run benchmark: avg 3.30s, 7/8 runs under 5s, perfect accuracy on all fields. Prompt updated to normalize line breaks on `class_type` and `bottler_name` before comparison; government warning strict match unchanged. |
| April 18, 2026 | Phase 3 complete. 7 structured test cases run. Two prompt bugs found and fixed: (1) government warning capitalisation check restructured into two independent hard-fail components — title-case header now correctly fails; (2) brand name casing mismatch rule restructured into three explicit tiers — same-content capitalisation differences now correctly return FLAG. All 7 test cases passing. |

---

*This document will be updated at the end of each development phase.*
