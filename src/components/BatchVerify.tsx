"use client";

import { useState, useCallback } from "react";
import DropZone from "./DropZone";
import BatchResultsTable from "./BatchResultsTable";
import type { BatchVerificationResponse } from "@/lib/types";

export default function BatchVerify() {
  const [images, setImages] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [result, setResult] = useState<BatchVerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImages = useCallback((files: File[]) => {
    setImages((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !existing.has(f.name))];
    });
    setResult(null);
    setError(null);
  }, []);

  const handleCsv = useCallback((files: File[]) => {
    setCsvFile(files[0] ?? null);
    setResult(null);
    setError(null);
  }, []);

  const removeImage = (name: string) =>
    setImages((prev) => prev.filter((f) => f.name !== name));

  const handleSubmit = async () => {
    if (images.length === 0) {
      setError("Please upload at least one label image.");
      return;
    }
    if (!csvFile) {
      setError("Please upload a CSV file with expected field values.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("csv", csvFile);
      images.forEach((img) => formData.append(`image_${img.name}`, img));

      const res = await fetch("/api/verify-batch", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Batch verification failed. Please try again.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const labelCount = images.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Images */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Label Images
          </h2>
          <DropZone
            accept={{
              "image/jpeg": [".jpg", ".jpeg"],
              "image/png": [".png"],
              "image/webp": [".webp"],
            }}
            multiple
            label="Drag & drop label images here, or click to browse"
            hint="JPG, PNG, or WEBP — multiple files supported"
            onFiles={handleImages}
          />
          {images.length > 0 && (
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto pr-1">
              {images.map((img) => (
                <div
                  key={img.name}
                  className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm"
                >
                  <span className="text-gray-700 truncate">{img.name}</span>
                  <button
                    onClick={() => removeImage(img.name)}
                    className="text-gray-400 hover:text-red-500 ml-3 flex-shrink-0 text-lg leading-none"
                    aria-label={`Remove ${img.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CSV */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Application Data (CSV)
          </h2>
          <DropZone
            accept={{ "text/csv": [".csv"], "text/plain": [".csv"] }}
            label="Drag & drop CSV file here, or click to browse"
            hint="One row per label — see format below"
            onFiles={handleCsv}
          />
          {csvFile && (
            <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2">
              <span className="text-sm text-blue-700 font-medium truncate">
                {csvFile.name}
              </span>
              <button
                onClick={() => setCsvFile(null)}
                className="text-blue-400 hover:text-red-500 ml-3 flex-shrink-0 text-lg leading-none"
                aria-label="Remove CSV"
              >
                ×
              </button>
            </div>
          )}

          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-600 mb-1">CSV format:</p>
            <code className="text-xs text-gray-500 block leading-relaxed">
              filename,brand_name,class_type,abv,<br />
              &nbsp;&nbsp;net_contents,bottler_name,country_of_origin<br />
              label_001.jpg,Old Tom Distillery,...
            </code>
            <p className="text-xs text-gray-400 mt-2">
              Leave <code>country_of_origin</code> blank for domestic labels.
              Government warning is always auto-checked — no column needed.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || labelCount === 0 || !csvFile}
        className="w-full bg-[#1a4480] hover:bg-[#163a6e] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors text-sm"
      >
        {loading
          ? `Verifying ${labelCount} label${labelCount !== 1 ? "s" : ""}…`
          : labelCount > 0
          ? `Verify ${labelCount} Label${labelCount !== 1 ? "s" : ""}`
          : "Verify Labels"}
      </button>

      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#1a4480] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Processing all labels in parallel…</p>
          </div>
        </div>
      )}

      {!loading && result && <BatchResultsTable response={result} />}
    </div>
  );
}
