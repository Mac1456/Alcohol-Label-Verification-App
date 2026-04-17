"use client";

import { useState } from "react";
import type { BatchVerificationResponse, OverallStatus } from "@/lib/types";
import FieldResultRow from "./FieldResultRow";

interface BatchResultsTableProps {
  response: BatchVerificationResponse;
}

const STATUS_BADGE: Record<OverallStatus, string> = {
  pass: "bg-green-100 text-green-800",
  flag: "bg-amber-100 text-amber-800",
  fail: "bg-red-100 text-red-800",
  error: "bg-gray-100 text-gray-600",
};

export default function BatchResultsTable({ response }: BatchResultsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { results, summary } = response;

  const toggle = (filename: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: summary.total, style: "bg-gray-100 text-gray-800" },
          { label: "Passed", value: summary.passed, style: "bg-green-100 text-green-800" },
          { label: "Flagged", value: summary.flagged, style: "bg-amber-100 text-amber-800" },
          { label: "Failed", value: summary.failed, style: "bg-red-100 text-red-800" },
        ].map(({ label, value, style }) => (
          <div key={label} className={`rounded-lg p-3 text-center ${style}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Label rows */}
      <div className="space-y-2">
        {results.map((r) => {
          const isExpandable = Boolean(r.result);
          const isOpen = expanded.has(r.filename);

          return (
            <div
              key={r.filename}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <button
                onClick={() => isExpandable && toggle(r.filename)}
                disabled={!isExpandable}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  isExpandable ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0 ${
                      STATUS_BADGE[r.status]
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {r.filename}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.result?.processing_time_ms !== undefined && (
                    <span className="text-xs text-gray-400">
                      {(r.result.processing_time_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                  {isExpandable && (
                    <span className="text-gray-400 text-sm">{isOpen ? "▾" : "▸"}</span>
                  )}
                </div>
              </button>

              {r.error && (
                <p className="px-4 pb-3 text-sm text-red-600">{r.error}</p>
              )}

              {isOpen && r.result && (
                <div className="border-t border-gray-200 p-4 space-y-2 bg-gray-50">
                  {r.result.image_quality === "poor" && r.result.image_quality_notes && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      Image quality: {r.result.image_quality_notes}
                    </p>
                  )}
                  {r.result.fields.map((field, i) => (
                    <FieldResultRow key={i} result={field} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
