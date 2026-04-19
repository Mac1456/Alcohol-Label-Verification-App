#!/usr/bin/env node
/**
 * Batch parallelization test
 *
 * Submits a full batch (CSV + images) to /api/verify-batch and measures
 * total wall-clock time and per-label processing time.
 *
 * Usage:
 *   node scripts/tests/batch-parallelization.js --size 10
 *   node scripts/tests/batch-parallelization.js --size 20
 *   node scripts/tests/batch-parallelization.js --size 10 --host http://localhost:3001
 */

const fs = require("fs");
const path = require("path");
// FormData and Blob are globals in Node 18+

function getArg(name, defaultValue) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : defaultValue;
}

const SIZE = parseInt(getArg("size", "10"), 10);
const HOST = getArg("host", "http://localhost:3001");
const ASSETS_DIR = path.resolve(process.cwd(), `test-labels/batch/${SIZE}`);
const CSV_FILE   = path.join(ASSETS_DIR, `batch_${SIZE}.csv`);

async function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Error: assets directory not found: ${ASSETS_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: CSV not found: ${CSV_FILE}`);
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         TTB Batch API — Parallelization Test            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Batch size  : ${SIZE}`);
  console.log(`  Assets dir  : ${ASSETS_DIR}`);
  console.log(`  Host        : ${HOST}`);
  console.log("");

  const form = new FormData();

  // Attach CSV
  const csvText = fs.readFileSync(CSV_FILE, "utf8");
  form.append("csv", new Blob([csvText], { type: "text/csv" }), `batch_${SIZE}.csv`);

  // Attach all images
  const imageFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith(".png"));
  for (const filename of imageFiles) {
    const imgPath = path.join(ASSETS_DIR, filename);
    const imgBytes = fs.readFileSync(imgPath);
    form.append(`image_${filename}`, new Blob([imgBytes], { type: "image/png" }), filename);
  }

  console.log(`  Images attached: ${imageFiles.length}`);
  console.log("  Submitting batch...\n");

  const start = Date.now();

  const res = await fetch(`${HOST}/api/verify-batch`, {
    method: "POST",
    body: form,
  });

  const elapsed = (Date.now() - start) / 1000;

  if (!res.ok) {
    const text = await res.text();
    console.error(`  HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  const results = data.results ?? [];

  // Per-label results
  console.log("  Per-label results:");
  for (const r of results) {
    const processingMs = r.result?.processing_time_ms;
    const timeStr = processingMs != null ? `${(processingMs / 1000).toFixed(3)}s` : "n/a";
    const errStr = r.error ? ` — ${r.error}` : "";
    console.log(`    ${r.filename.padEnd(18)} status=${r.status.padEnd(5)}  api_time=${timeStr}${errStr}`);
  }

  // Collect per-label times (only those that have a result)
  const perLabelTimes = results
    .filter(r => r.result?.processing_time_ms != null)
    .map(r => r.result.processing_time_ms / 1000);

  const errors = results.filter(r => r.status === "error");

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                       Summary                           ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Batch size        : ${SIZE}`);
  console.log(`  Total wall time   : ${elapsed.toFixed(3)}s`);

  if (perLabelTimes.length > 0) {
    const sorted = [...perLabelTimes].sort((a, b) => a - b);
    const sum = perLabelTimes.reduce((a, b) => a + b, 0);
    const avg = sum / perLabelTimes.length;
    console.log(`  Per-label min     : ${sorted[0].toFixed(3)}s`);
    console.log(`  Per-label max     : ${sorted[sorted.length - 1].toFixed(3)}s`);
    console.log(`  Per-label avg     : ${avg.toFixed(3)}s`);
    console.log(`  Slowest vs fastest: ${(sorted[sorted.length - 1] - sorted[0]).toFixed(3)}s spread`);
  }

  console.log(`  Passed            : ${data.summary?.passed ?? "?"}/${SIZE}`);
  console.log(`  Flagged           : ${data.summary?.flagged ?? "?"}/${SIZE}`);
  console.log(`  Failed            : ${data.summary?.failed ?? "?"}/${SIZE}`);
  console.log(`  Errored           : ${data.summary?.errored ?? "?"}/${SIZE}`);

  if (errors.length > 0) {
    console.log("");
    console.log("  Errors:");
    for (const e of errors) {
      console.log(`    ${e.filename}: ${e.error}`);
    }
  }

  console.log("");
}

main().catch(err => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
