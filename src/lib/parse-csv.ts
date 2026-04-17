import type { BatchLabelRecord } from "./types";

const KNOWN_HEADERS = [
  "filename",
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler_name",
  "country_of_origin",
] as const;

type KnownHeader = (typeof KNOWN_HEADERS)[number];

export function parseCSV(csvText: string): BatchLabelRecord[] {
  const lines = csvText
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row.");
  }

  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  if (!headers.includes("filename")) {
    throw new Error("CSV is missing a required 'filename' column.");
  }

  const records: BatchLabelRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const record: Partial<BatchLabelRecord> = {};

    headers.forEach((header, idx) => {
      if (KNOWN_HEADERS.includes(header as KnownHeader)) {
        (record as Record<string, string>)[header] = values[idx]?.trim() ?? "";
      }
    });

    if (!record.filename) {
      throw new Error(`Row ${i + 1} has no filename value.`);
    }

    records.push(record as BatchLabelRecord);
  }

  return records;
}

// Handles quoted fields containing commas (e.g. "Smith, John - Bardstown, KY")
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
