"use client";

import { useState, useCallback } from "react";
import DropZone from "./DropZone";
import FieldForm from "./FieldForm";
import ResultsPanel from "./ResultsPanel";
import { fileToBase64 } from "@/lib/image-utils";
import type { LabelFields, VerificationResult } from "@/lib/types";

export default function SingleVerify() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fields, setFields] = useState<LabelFields>({});
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setImage(file);
    setResult(null);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }, [preview]);

  const handleSubmit = async () => {
    if (!image) {
      setError("Please upload a label image.");
      return;
    }
    const hasAnyField = Object.values(fields).some((v) => v && v.trim() !== "");
    if (!hasAnyField) {
      setError("Please enter at least one expected field value from the application.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base64 = await fileToBase64(image);

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, imageType: image.type, fields }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Verification failed. Please try again.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: inputs */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Label Image
          </h2>
          <DropZone
            accept={{
              "image/jpeg": [".jpg", ".jpeg"],
              "image/png": [".png"],
              "image/webp": [".webp"],
            }}
            label="Drag & drop label image here, or click to browse"
            hint="JPG, PNG, or WEBP"
            onFiles={handleImageDrop}
          />
          {preview && (
            <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Label preview"
                className="max-h-52 w-full object-contain"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">{image?.name}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Application Data
            </h2>
            <button
              type="button"
              onClick={() => setFields({
                brand_name: "OLD TOM DISTILLERY",
                class_type: "Kentucky Straight Bourbon Whiskey",
                abv: "45% Alc./Vol. (90 Proof)",
                net_contents: "750 mL",
                bottler_name: "Old Tom Distillery Co. — Bardstown, KY",
                country_of_origin: "",
              })}
              className="text-xs text-[#1a4480] hover:text-[#163a6e] hover:underline"
            >
              Load sample data
            </button>
          </div>
          <FieldForm fields={fields} onChange={setFields} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !image}
          className="w-full bg-[#1a4480] hover:bg-[#163a6e] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors text-sm"
        >
          {loading ? "Verifying label…" : "Verify Label"}
        </button>
      </div>

      {/* Right: results */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Verification Results
        </h2>

        {loading && (
          <div className="flex items-center justify-center h-56 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-[#1a4480] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Analyzing label…</p>
            </div>
          </div>
        )}

        {!loading && result && <ResultsPanel result={result} />}

        {!loading && !result && (
          <div className="flex items-center justify-center h-56 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
            <p className="text-sm">Results will appear here after verification</p>
          </div>
        )}
      </div>
    </div>
  );
}
