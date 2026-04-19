#!/usr/bin/env node
/**
 * Verification API benchmark — response time distribution with 95% CI
 *
 * Usage:
 *   node scripts/benchmark.js [options]
 *
 * Options:
 *   --runs <n>         Number of verification calls (default: 30)
 *   --image <path>     Path to label image (default: Test Labels/OLD TOM DISTILLERY test label_1.png)
 *   --host <url>       Base URL of the running dev server (default: http://localhost:3001)
 *   --fields <json>    JSON string of expected field values (default: Old Tom sample data)
 *   --concurrency <n>  Run calls in parallel batches of n (default: 1 = sequential)
 *
 * Examples:
 *   node scripts/benchmark.js
 *   node scripts/benchmark.js --runs 50
 *   node scripts/benchmark.js --runs 20 --concurrency 5
 *   node scripts/benchmark.js --image "Test Labels/OLD TOM DISTILLERY test label_2.png"
 */

const fs = require("fs");
const path = require("path");

// ─── CLI args ────────────────────────────────────────────────────────────────

function getArg(name, defaultValue) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : defaultValue;
}

const RUNS        = parseInt(getArg("runs", "30"), 10);
const IMAGE_PATH  = getArg("image", "test-labels/OLD TOM DISTILLERY test label_1.png");
const HOST        = getArg("host", "http://localhost:3001");
const CONCURRENCY = parseInt(getArg("concurrency", "1"), 10);

const DEFAULT_FIELDS = {
  brand_name:   "OLD TOM DISTILLERY",
  class_type:   "Kentucky Straight Bourbon Whiskey",
  abv:          "45% Alc./Vol. (90 Proof)",
  net_contents: "750 mL",
  bottler_name: "Old Tom Distillery Co. — Bardstown, KY",
};

let FIELDS;
try {
  const raw = getArg("fields", null);
  FIELDS = raw ? JSON.parse(raw) : DEFAULT_FIELDS;
} catch {
  console.error("Error: --fields must be valid JSON");
  process.exit(1);
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1));
}

function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// t-distribution critical values for 95% CI (two-tailed, alpha=0.025 per tail)
// Covers df 1–40, 60, 80, 100, 120, Inf
const T_TABLE = [
  [1,12.706],[2,4.303],[3,3.182],[4,2.776],[5,2.571],
  [6,2.447],[7,2.365],[8,2.306],[9,2.262],[10,2.228],
  [11,2.201],[12,2.179],[13,2.160],[14,2.145],[15,2.131],
  [16,2.120],[17,2.110],[18,2.101],[19,2.093],[20,2.086],
  [21,2.080],[22,2.074],[23,2.069],[24,2.064],[25,2.060],
  [26,2.056],[27,2.052],[28,2.048],[29,2.045],[30,2.042],
  [40,2.021],[60,2.000],[80,1.990],[100,1.984],[120,1.980],
  [Infinity,1.960],
];

function tCritical(df) {
  for (let i = 0; i < T_TABLE.length - 1; i++) {
    const [df0, t0] = T_TABLE[i];
    const [df1, t1] = T_TABLE[i + 1];
    if (df <= df0) return t0;
    if (df < df1) {
      // linear interpolation
      const frac = (df - df0) / (df1 - df0);
      return t0 + frac * (t1 - t0);
    }
  }
  return 1.96;
}

function confidenceInterval95(arr) {
  const n  = arr.length;
  const m  = mean(arr);
  const sd = stddev(arr);
  const se = sd / Math.sqrt(n);
  const t  = tCritical(n - 1);
  return { lower: m - t * se, upper: m + t * se, margin: t * se };
}

// ─── Single verification call ────────────────────────────────────────────────

async function runOnce(imageBase64, runNumber) {
  const start = Date.now();
  const res = await fetch(`${HOST}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64, imageType: "image/png", fields: FIELDS }),
  });
  const elapsed = (Date.now() - start) / 1000;
  const data = await res.json();

  const fieldSummary = (data.fields || [])
    .map((f) => `${f.field}=${f.status}`)
    .join(", ");

  const marker = elapsed > 5 ? " ⚠ >5s" : "";
  console.log(`  Run ${String(runNumber).padStart(3)} | ${elapsed.toFixed(3)}s | overall=${data.overall_status} | ${fieldSummary}${marker}`);

  return { elapsed, overall: data.overall_status, fields: data.fields };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const absImage = path.resolve(process.cwd(), IMAGE_PATH);
  if (!fs.existsSync(absImage)) {
    console.error(`Error: image not found at ${absImage}`);
    process.exit(1);
  }

  const imageBase64 = fs.readFileSync(absImage).toString("base64");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║          TTB Verification API — Benchmark Runner        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Image       : ${IMAGE_PATH}`);
  console.log(`  Host        : ${HOST}`);
  console.log(`  Runs        : ${RUNS}`);
  console.log(`  Concurrency : ${CONCURRENCY}`);
  console.log(`  Fields      : ${Object.entries(FIELDS).map(([k,v])=>`${k}="${v}"`).join(", ")}`);
  console.log("");
  console.log("  Results:");

  const results = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < RUNS; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, RUNS); j++) {
      batch.push(runOnce(imageBase64, j + 1));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  // ─── Analysis ──────────────────────────────────────────────────────────────

  const times  = results.map((r) => r.elapsed);
  const sorted = [...times].sort((a, b) => a - b);

  const n     = times.length;
  const avg   = mean(times);
  const sd    = stddev(times);
  const ci    = confidenceInterval95(times);

  const overallCounts = results.reduce((acc, r) => {
    acc[r.overall] = (acc[r.overall] || 0) + 1;
    return acc;
  }, {});

  const under5  = times.filter((t) => t < 5).length;
  const over5   = n - under5;

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                    Distribution Summary                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Runs           : ${n}`);
  console.log(`  Min            : ${sorted[0].toFixed(3)}s`);
  console.log(`  Max            : ${sorted[n-1].toFixed(3)}s`);
  console.log(`  Range          : ${(sorted[n-1] - sorted[0]).toFixed(3)}s`);
  console.log(`  Mean           : ${avg.toFixed(3)}s`);
  console.log(`  Std Dev        : ${sd.toFixed(3)}s`);
  console.log(`  Median (p50)   : ${percentile(sorted, 50).toFixed(3)}s`);
  console.log(`  p75            : ${percentile(sorted, 75).toFixed(3)}s`);
  console.log(`  p90            : ${percentile(sorted, 90).toFixed(3)}s`);
  console.log(`  p95            : ${percentile(sorted, 95).toFixed(3)}s`);
  console.log("");
  console.log("  95% Confidence Interval (t-distribution):");
  console.log(`  Mean ± margin  : ${avg.toFixed(3)}s ± ${ci.margin.toFixed(3)}s`);
  console.log(`  CI lower bound : ${ci.lower.toFixed(3)}s`);
  console.log(`  CI upper bound : ${ci.upper.toFixed(3)}s`);
  console.log(`  Interpretation : We are 95% confident the true mean`);
  console.log(`                   response time is between ${ci.lower.toFixed(2)}s and ${ci.upper.toFixed(2)}s`);
  console.log("");
  console.log("  5-second benchmark:");
  console.log(`  Under 5s       : ${under5}/${n} (${((under5/n)*100).toFixed(1)}%)`);
  if (over5 > 0) console.log(`  Over 5s        : ${over5}/${n} (${((over5/n)*100).toFixed(1)}%)`);
  console.log("");
  console.log("  Verification accuracy:");
  Object.entries(overallCounts).forEach(([status, count]) => {
    console.log(`  overall=${status.padEnd(5)}: ${count}/${n}`);
  });
  console.log("");
}

main().catch((err) => {
  console.error("Benchmark failed:", err.message);
  process.exit(1);
});
