import type { VerificationResult } from "@/lib/types";
import FieldResultRow from "./FieldResultRow";

interface ResultsPanelProps {
  result: VerificationResult;
}

const BANNER_CONFIG = {
  pass: {
    style: "bg-green-100 border-green-300 text-green-800",
    message: "All fields passed — label matches application.",
  },
  flag: {
    style: "bg-amber-100 border-amber-300 text-amber-800",
    message: "Review required — one or more fields need agent attention.",
  },
  fail: {
    style: "bg-red-100 border-red-300 text-red-800",
    message: "Verification failed — label does not match application.",
  },
  error: {
    style: "bg-gray-100 border-gray-300 text-gray-700",
    message: "An error occurred during verification.",
  },
} as const;

export default function ResultsPanel({ result }: ResultsPanelProps) {
  const status = result.overall_status as keyof typeof BANNER_CONFIG;
  const banner = BANNER_CONFIG[status] ?? BANNER_CONFIG.error;

  return (
    <div className="space-y-4">
      <div className={`border rounded-lg p-4 ${banner.style}`}>
        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold text-sm">{banner.message}</p>
          {result.processing_time_ms !== undefined && (
            <p className="text-xs opacity-70 flex-shrink-0">
              {(result.processing_time_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>
        {result.image_quality === "poor" && result.image_quality_notes && (
          <p className="mt-1 text-sm opacity-80">
            Image quality note: {result.image_quality_notes}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {result.fields.map((field, i) => (
          <FieldResultRow key={i} result={field} />
        ))}
      </div>
    </div>
  );
}
