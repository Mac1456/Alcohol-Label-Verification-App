#!/usr/bin/env node
/**
 * Imperfect image handling test
 *
 * Runs three imperfect label images (angled, glare, low lighting) through
 * the verification API to validate graceful degradation behaviour.
 *
 * Run: node scripts/tests/imperfect-images.js
 */

const fs = require("fs");
const path = require("path");

const HOST = process.argv.includes("--host")
  ? process.argv[process.argv.indexOf("--host") + 1]
  : "http://localhost:3001";

const IMAGES = [
  { file: "test-labels/ImperfectTestLabel1.png", label: "Imperfect Label 1" },
  { file: "test-labels/ImperfectTestLabel2.png", label: "Imperfect Label 2" },
  { file: "test-labels/ImperfectTestLabel3.png", label: "Imperfect Label 3" },
];

const FIELDS = {
  brand_name:   "OLD TOM DISTILLERY",
  class_type:   "Kentucky Straight Bourbon Whiskey",
  abv:          "45% Alc./Vol. (90 Proof)",
  net_contents: "750 mL",
  bottler_name: "Old Tom Distillery Co. — Bardstown, KY",
};

async function testImage({ file, label }) {
  const absPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absPath)) {
    console.log(`  ✗ File not found: ${absPath}`);
    return;
  }

  const imageBase64 = fs.readFileSync(absPath).toString("base64");
  const start = Date.now();

  const res = await fetch(`${HOST}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64, imageType: "image/png", fields: FIELDS }),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const data = await res.json();

  console.log(`\n  ── ${label} (${elapsed}s) ──`);
  console.log(`  overall_status  : ${data.overall_status}`);
  console.log(`  image_quality   : ${data.image_quality}`);
  if (data.image_quality_notes) {
    console.log(`  quality_notes   : ${data.image_quality_notes}`);
  }

  if (data.fields?.length) {
    console.log(`  Fields:`);
    for (const f of data.fields) {
      const extra = f.explanation ? ` — ${f.explanation}` : "";
      console.log(`    ${f.field.padEnd(20)} ${f.status}${extra}`);
    }
  } else {
    console.log(`  Fields          : (none — image unreadable)`);
  }
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         TTB Verification — Imperfect Image Test         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Host: ${HOST}\n`);

  for (const img of IMAGES) {
    await testImage(img);
  }

  console.log("\n");
}

main().catch(err => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
