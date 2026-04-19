#!/usr/bin/env node
/**
 * Riverstone Reserve — government warning fix validation
 *
 * Reproduces the 20-run parallel test used to confirm that the government
 * warning hallucination bug (false fails on correct labels) is resolved.
 *
 * Run: node scripts/test-riverstone-reserve.js
 */

const { execSync } = require("child_process");

const IMAGE = "test-labels/Gemini_Generated_Image_xvimmuxvimmuxvim.png";
const FIELDS = {
  brand_name:   "RIVERSTONE RESERVE",
  class_type:   "Small Batch Rye Whiskey",
  abv:          "47% Alc./Vol. (94 Proof)",
  net_contents: "750 mL",
  bottler_name: "Riverstone Spirits Co. - Lexington KY",
  country_of_origin: "USA",
};

const cmd = [
  "node scripts/benchmark.js",
  "--runs 20",
  "--concurrency 5",
  `--image "${IMAGE}"`,
  `--fields '${JSON.stringify(FIELDS)}'`,
].join(" ");

console.log("Running Riverstone Reserve validation test...\n");
execSync(cmd, { stdio: "inherit" });
