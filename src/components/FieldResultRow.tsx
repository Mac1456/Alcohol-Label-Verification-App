import type { FieldResult } from "@/lib/types";
import { FIELD_LABELS } from "@/constants/ttb";

interface FieldResultRowProps {
  result: FieldResult;
}

const STATUS_CONFIG = {
  pass: {
    rowBg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
    icon: "✓",
    iconColor: "text-green-600",
  },
  flag: {
    rowBg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    icon: "⚑",
    iconColor: "text-amber-600",
  },
  fail: {
    rowBg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
    icon: "✕",
    iconColor: "text-red-600",
  },
} as const;

export default function FieldResultRow({ result }: FieldResultRowProps) {
  const config = STATUS_CONFIG[result.status] ?? STATUS_CONFIG.flag;
  const label = FIELD_LABELS[result.field] ?? result.field;

  return (
    <div className={`rounded-lg border p-4 ${config.rowBg} ${config.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${config.iconColor}`} aria-hidden>
            {config.icon}
          </span>
          <span className="font-medium text-gray-800 text-sm">{label}</span>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0 ${config.badge}`}
        >
          {result.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">On Label</p>
          <p className="text-gray-800 font-medium break-words">
            {result.extracted_value || (
              <span className="text-gray-400 italic">Not found</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Expected</p>
          <p className="text-gray-700 break-words">
            {result.expected_value || (
              <span className="text-gray-400 italic">—</span>
            )}
          </p>
        </div>
      </div>

      {result.explanation && (
        <p className="mt-2 text-xs text-gray-600 border-t border-gray-200 pt-2 italic">
          {result.explanation}
        </p>
      )}
    </div>
  );
}
