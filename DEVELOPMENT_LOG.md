# Development Log: AI-Powered Alcohol Label Verification App
**Last Updated:** April 17, 2026
**Status:** Phase 2 complete — initial testing done, prompt fix applied, app verified working end-to-end

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
| `claude-sonnet-4-6` via `client.beta.messages` | Core AI engine for label verification at runtime |
| Next.js 15 (App Router) | Full-stack React framework (frontend + API routes) |
| Tailwind CSS 3 | Styling |
| `react-dropzone` | File upload UI component |
| `@anthropic-ai/sdk` 0.30.x | Anthropic API client for Node.js |
| Vercel | Deployment (pending) |
| AI image generation (TBD) | Generating test label images for Phase 5 testing |

---

## Assumptions Made

| Assumption | Rationale |
|---|---|
| Cloud API (Anthropic) is acceptable for the prototype | Marcus flagged firewall concerns for production, but explicitly said the prototype doesn't need to follow those constraints. Claude vision is necessary to hit the 5-second benchmark and handle judgment. |
| Batch mode uses CSV upload (Option A) | Per-label application data can't be entered manually for 200–300 labels. CSV maps filenames to expected field values. Confirmed before development started. |
| Government warning is always hardcoded, never in the CSV | The check is always exact-match against the TTB ABLA standard text. No agent input needed or wanted — an agent entering it manually introduces error. |
| No authentication required | Marcus said "just don't do anything crazy" for the prototype. No PII is stored. Auth would add scope without adding evaluation value. |
| Desktop-first layout | Agents work at desks. Mobile optimization is not mentioned in the brief and would add scope. |
| JPG, PNG, and WEBP are sufficient image formats | Standard formats for label photography. PDF and TIFF out of scope. |
| Country of origin check is skipped if not provided | Field is only required for imports. Domestic labels should not fail on a missing import field. |
| TTB government warning text sourced from ABLA 1988 | "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems." Hardcoded in `src/constants/ttb.ts`. |

---

## Open Questions

| Question | Status |
|---|---|
| Rate limit handling for large batches (300 labels) | ⬜ To be assessed during Phase 5 testing |
| Whether `Promise.all()` is sufficient for 300 labels or needs chunking | ⬜ To be tested |
| Exact response time for single label with real image | ⬜ To be measured in Phase 5 |

---

## Change Log

| Date | Change |
|---|---|
| April 17, 2026 | Initial document created. Phase 0 (discovery and planning) complete. PRD drafted. Tech stack selected. |
| April 17, 2026 | Phase 1 complete. Full application scaffolded and implemented: API routes, all UI components, Claude integration with prompt caching, batch CSV processing, TypeScript errors resolved. Dev server running. Code pushed to GitHub. |
| April 17, 2026 | Phase 2 complete. First end-to-end test run with AI-generated label image. Core verification (Class/Type, ABV, Net Contents) passed correctly. Brand Name false FLAG bug identified and fixed via prompt update — exact matches now explicitly required to return PASS. "Load Sample Data" button added to single label form. Batch CSV architecture and single-label prototype assumption documented. |

---

*This document will be updated at the end of each development phase.*
