# TTB Label Verification — Development Checklist

## Phase 0: Planning & Setup ✅
- [x] Read and parse project brief
- [x] Synthesize requirements from stakeholder interviews
- [x] Create PRD (`PRD_alcohol_label_verification.md`)
- [x] Select tech stack (Next.js, Tailwind, Anthropic SDK, Vercel)
- [x] Document assumptions and open questions in PRD and dev log
- [x] Resolve batch mode UX: **Option A — CSV upload** (maps filenames to expected field values)
- [x] Confirm government warning check is always exact-match against hardcoded TTB standard text (not in CSV)
- [x] Confirm country of origin is optional — skip check if blank in CSV or form

---

## Phase 1: Project Scaffolding ✅
- [x] Initialize Next.js project structure (App Router, TypeScript, Tailwind)
- [x] Write `package.json` with all dependencies
- [x] Configure `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- [x] Add `.gitignore` (excludes `.env.local`, `node_modules`, `.next`)
- [x] Create `.env.local.example` with `ANTHROPIC_API_KEY` placeholder
- [x] Write `DEVELOPMENT_LOG.md`

---

## Phase 2: Core Library Layer ✅
- [x] `src/constants/ttb.ts` — hardcoded TTB government warning text, field labels
- [x] `src/lib/types.ts` — TypeScript types for all verification data structures
- [x] `src/lib/image-utils.ts` — client-side FileReader base64 helper
- [x] `src/lib/parse-csv.ts` — CSV parser for batch mode (handles quoted fields, optional columns)
- [x] `src/lib/prompt.ts` — builds the per-label verification prompt sent to Claude
- [x] `src/lib/claude.ts` — Anthropic SDK wrapper with prompt caching on system message

---

## Phase 3: API Routes ✅
- [x] `src/app/api/verify/route.ts` — POST endpoint for single-label verification
  - Accepts `{ image: base64, imageType, fields }` JSON body
  - Returns `VerificationResult` JSON
- [x] `src/app/api/verify-batch/route.ts` — POST endpoint for batch verification
  - Accepts FormData: one CSV file + N image files
  - Cross-validates CSV filenames against uploaded image filenames (surfaces mismatches)
  - Processes all labels in parallel via `Promise.all()`
  - Returns `BatchVerificationResponse` with per-label results and summary counts

---

## Phase 4: UI Components ✅
- [x] `src/components/DropZone.tsx` — drag-and-drop file upload (wraps react-dropzone)
- [x] `src/components/FieldForm.tsx` — form for entering expected application field values
- [x] `src/components/FieldResultRow.tsx` — single field result card (pass/flag/fail with color coding)
- [x] `src/components/ResultsPanel.tsx` — full single-label results display
- [x] `src/components/SingleVerify.tsx` — single label verification flow
- [x] `src/components/BatchResultsTable.tsx` — batch results table with expandable rows
- [x] `src/components/BatchVerify.tsx` — batch verification flow
- [x] `src/app/globals.css` — Tailwind base styles
- [x] `src/app/layout.tsx` — root layout with TTB header
- [x] `src/app/page.tsx` — main page with Single / Batch tab switcher

---

## Phase 5: End-to-End Testing
- [ ] Test single-label verification with a real label image
- [ ] Test government warning fail case (title case warning)
- [ ] Test brand name flag case ("STONE'S THROW" vs "Stone's Throw")
- [ ] Test missing government warning (hard fail)
- [ ] Test batch mode with CSV + images — all pass case
- [ ] Test batch mode with a CSV/image filename mismatch
- [ ] Test batch mode with empty `country_of_origin`
- [ ] Verify single-label response time ≤ 5 seconds
- [ ] Review UI on large screen — "grandma test" (obvious, no hidden steps)

---

## Phase 6: Polish
- [ ] Confirm all error states show human-readable messages (not raw API errors)
- [ ] Add image preview in single-label mode
- [ ] Review color contrast and button sizes for accessibility
- [ ] Update `README.md` with confirmed setup instructions after local testing

---

## Phase 7: Deployment (Later)
- [ ] Create Vercel project linked to this repo
- [ ] Add `ANTHROPIC_API_KEY` to Vercel environment variables
- [ ] Deploy and smoke-test on live URL
- [ ] Update `README.md` with deployed URL

---

## Known Limitations / Out of Scope
- No COLA system integration
- No authentication
- No persistent storage or audit logs
- Batch payloads with very large images (>5MB each) may hit server body size limits in production — use compressed label photos for now
- `Promise.all()` for large batches (300+) may hit Anthropic rate limits; chunk if needed in production
- Desktop-only layout; no mobile optimization
