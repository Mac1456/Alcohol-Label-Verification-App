#!/usr/bin/env node
/**
 * Imperfect image consistency test
 *
 * Runs each imperfect label multiple times and reports per-field pass rates
 * to determine whether imperfect images can be read consistently.
 *
 * All three labels contain correct content — any fail is a readability failure.
 *
 * Usage:
 *   node scripts/tests/imperfect-consistency.js
 *   node scripts/tests/imperfect-consistency.js --runs 15
 *   node scripts/tests/imperfect-consistency.js --host http://localhost:3001
 */

const fs = require("fs");
const path = require("path");

function getArg(name, defaultValue) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : defaultValue;
}

const RUNS = parseInt(getArg("runs", "10"), 10);
const HOST = getArg("host", "http://localhost:3001");

const IMAGES = [
  {
    file: "test-labels/ImperfectTestLabel1.png",
    label: "Label 1 — Angled shot (30°)",
    defect: "30-degree perspective distortion",
  },
  {
    file: "test-labels/ImperfectTestLabel2.png",
    label: "Label 2 — Glare / reflection",
    defect: "Light glare partially washing out label areas",
  },
  {
    file: "test-labels/ImperfectTestLabel3.png",
    label: "Label 3 — Low lighting",
    defect: "Underexposed, grainy, low contrast",
  },
];

const FIELDS = {
  brand_name:   "OLD TOM DISTILLERY",
  class_type:   "Kentucky Straight Bourbon Whiskey",
  abv:          "45% Alc./Vol. (90 Proof)",
  net_contents: "750 mL",
  bottler_name: "Old Tom Distillery Co. \u2014 Bardstown, KY",
};

const FIELD_NAMES = [
  "brand_name", "class_type", "abv", "net_contents", "bottler_name", "government_warning"
];

async function runOnce(imageBase64, runNumber) {
  const start = Date.now();
  const res = await fetch(`${HOST}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64, imageType: "image/png", fields: FIELDS }),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const data = await res.json();

  const fieldMap = {};
  for (const f of (data.fields || [])) {
    fieldMap[f.field] = { status: f.status, explanation: f.explanation };
  }

  const fieldSummary = FIELD_NAMES.map(n => {
    const f = fieldMap[n];
    return f ? f.status[0].toUpperCase() : "?"; // P/F/L(flag)/?
  }).join(" ");

  process.stdout.write(`    Run ${String(runNumber).padStart(2)} | ${elapsed}s | overall=${data.overall_status?.padEnd(4)} | quality=${data.image_quality?.padEnd(10)} | [${fieldSummary}]\n`);

  return { overall: data.overall_status, quality: data.image_quality, fields: fieldMap };
}

async function testImage({ file, label, defect }) {
  const absPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absPath)) {
    console.log(`\n  ✗ File not found: ${absPath}`);
    return;
  }

  console.log(`\n  ┌─ ${label}`);
  console.log(`  │  Defect: ${defect}`);
  console.log(`  │  Field order: [brand  class  abv  contents  bottler  gov_warning]`);
  console.log(`  │  Status key: P=pass F=fail L=flag`);
  console.log(`  │`);

  const imageBase64 = fs.readFileSync(absPath).toString("base64");
  const results = [];

  for (let i = 1; i <= RUNS; i++) {
    const r = await runOnce(imageBase64, i);
    results.push(r);
  }

  // Per-field statistics
  const fieldStats = {};
  for (const name of FIELD_NAMES) {
    const statuses = results.map(r => r.fields[name]?.status ?? "missing");
    fieldStats[name] = {
      pass:    statuses.filter(s => s === "pass").length,
      flag:    statuses.filter(s => s === "flag").length,
      fail:    statuses.filter(s => s === "fail").length,
      missing: statuses.filter(s => s === "missing").length,
    };
  }

  const overallPass  = results.filter(r => r.overall === "pass").length;
  const overallFlag  = results.filter(r => r.overall === "flag").length;
  const overallFail  = results.filter(r => r.overall === "fail").length;
  const overallError = results.filter(r => r.overall === "error").length;
  const qualityGood  = results.filter(r => r.quality === "good").length;
  const qualityPoor  = results.filter(r => r.quality === "poor").length;
  const qualityUnreadable = results.filter(r => r.quality === "unreadable").length;

  console.log(`  │`);
  console.log(`  │  ── Summary (${RUNS} runs) ──`);
  console.log(`  │  Overall: pass=${overallPass} flag=${overallFlag} fail=${overallFail} error=${overallError}`);
  console.log(`  │  Quality: good=${qualityGood} poor=${qualityPoor} unreadable=${qualityUnreadable}`);
  console.log(`  │`);
  console.log(`  │  Per-field pass rates:`);
  for (const name of FIELD_NAMES) {
    const s = fieldStats[name];
    const passRate = ((s.pass / RUNS) * 100).toFixed(0);
    const bar = "█".repeat(Math.round(s.pass / RUNS * 20)).padEnd(20, "░");
    console.log(`  │    ${name.padEnd(20)} ${bar} ${passRate}%  (pass=${s.pass} flag=${s.flag} fail=${s.fail})`);
  }
  console.log(`  └─`);

  return { label, fieldStats, overallPass, overallFail, overallFlag };
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║      TTB — Imperfect Image Consistency Test             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Runs per image : ${RUNS}`);
  console.log(`  Host           : ${HOST}`);
  console.log(`  Note: All labels contain correct content.`);
  console.log(`        Any fail = readability failure, not genuine mismatch.`);

  const allResults = [];
  for (const img of IMAGES) {
    const r = await testImage(img);
    if (r) allResults.push(r);
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  Cross-Image Summary                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  for (const r of allResults) {
    const gwPass = r.fieldStats["government_warning"]?.pass ?? 0;
    const nonGwFields = FIELD_NAMES.filter(n => n !== "government_warning");
    const allNonGwPass = nonGwFields.every(n => r.fieldStats[n]?.pass === RUNS);
    console.log(`  ${r.label}`);
    console.log(`    Overall pass rate : ${r.overallPass}/${RUNS} (${((r.overallPass/RUNS)*100).toFixed(0)}%)`);
    console.log(`    Gov warning pass  : ${gwPass}/${RUNS}`);
    console.log(`    Other fields      : ${allNonGwPass ? "100% consistent" : "inconsistent — see per-field above"}`);
  }
  console.log("");
}

main().catch(err => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
