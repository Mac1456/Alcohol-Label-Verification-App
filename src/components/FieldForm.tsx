"use client";

import type { LabelFields } from "@/lib/types";

interface FieldConfig {
  key: keyof LabelFields;
  label: string;
  required: boolean;
  placeholder: string;
}

const FIELDS: FieldConfig[] = [
  {
    key: "brand_name",
    label: "Brand Name",
    required: true,
    placeholder: "e.g. OLD TOM DISTILLERY",
  },
  {
    key: "class_type",
    label: "Class / Type",
    required: true,
    placeholder: "e.g. Kentucky Straight Bourbon Whiskey",
  },
  {
    key: "abv",
    label: "Alcohol Content (ABV)",
    required: true,
    placeholder: "e.g. 45% Alc./Vol. (90 Proof)",
  },
  {
    key: "net_contents",
    label: "Net Contents",
    required: true,
    placeholder: "e.g. 750 mL",
  },
  {
    key: "bottler_name",
    label: "Bottler Name & Address",
    required: true,
    placeholder: "e.g. Old Tom Distillery Co. — Bardstown, KY",
  },
  {
    key: "country_of_origin",
    label: "Country of Origin",
    required: false,
    placeholder: "Leave blank for domestic labels",
  },
];

interface FieldFormProps {
  fields: LabelFields;
  onChange: (fields: LabelFields) => void;
}

export default function FieldForm({ fields, onChange }: FieldFormProps) {
  return (
    <div className="space-y-4">
      {FIELDS.map(({ key, label, required, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required ? (
              <span className="text-red-500 ml-1" aria-hidden>*</span>
            ) : (
              <span className="text-gray-400 ml-1 font-normal">(optional)</span>
            )}
          </label>
          <input
            type="text"
            value={fields[key] ?? ""}
            onChange={(e) => onChange({ ...fields, [key]: e.target.value })}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
          />
        </div>
      ))}
      <p className="text-xs text-gray-500 pt-1">
        Government Warning is always checked against the TTB standard text — no entry needed.
      </p>
    </div>
  );
}
