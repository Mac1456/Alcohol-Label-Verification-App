"use client";

import { useState } from "react";
import SingleVerify from "@/components/SingleVerify";
import BatchVerify from "@/components/BatchVerify";

const TABS = [
  {
    id: "single" as const,
    label: "Single Label",
    description: "Upload one label image and enter the expected field values.",
  },
  {
    id: "batch" as const,
    label: "Batch Upload",
    description:
      "Upload multiple images and a CSV with expected values for each.",
  },
];

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("single");
  const activeDescription = TABS.find((t) => t.id === activeTab)?.description;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Label Verification</h2>
        <p className="text-gray-500 mt-1 text-sm">{activeDescription}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#1a4480] text-[#1a4480]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {activeTab === "single" && <SingleVerify />}
        {activeTab === "batch" && <BatchVerify />}
      </div>
    </div>
  );
}
