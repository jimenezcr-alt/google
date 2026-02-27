"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAnalysis, downloadCandidateReport } from "@/lib/api";
import type { AnalysisResult } from "@/lib/types";
import AnalysisResults from "@/components/AnalysisResults";

function AnalysisContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = useState<(AnalysisResult & { filename?: string; timestamp?: string; analysis_time_seconds?: number; api_calls?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No analysis ID");
      return;
    }
    getAnalysis(id)
      .then((r) => {
        setData({
          ...r.result,
          filename: r.filename,
          timestamp: (r as unknown as { timestamp?: string }).timestamp,
          analysis_time_seconds: r.analysis_time_seconds,
          api_calls: r.api_calls,
        });
      })
      .catch(() => setError("Analysis not found."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="text-xl font-bold mb-2">Analysis not found</h2>
          <p className="text-[#5F6368] mb-6">{error}</p>
          <Link href="/dashboard" className="text-[#4285F4] hover:underline font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center mb-6 animate-fade-in">
        <div>
          <Link href="/dashboard" className="text-sm text-[#4285F4] hover:underline flex items-center gap-1 mb-2">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-[#202124]">
            {data.filename || "CV Analysis"}
          </h1>
          {data.timestamp && (
            <p className="text-sm text-[#9AA0A6] mt-0.5">
              Analyzed on {new Date(data.timestamp).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data.analysis_time_seconds && (
            <div className="text-right">
              <p className="text-xs text-[#9AA0A6]">AI Time</p>
              <p className="font-bold text-[#34A853]">{data.analysis_time_seconds}s</p>
            </div>
          )}
          {data.api_calls !== undefined && (
            <div className="text-right">
              <p className="text-xs text-[#9AA0A6]">API Calls</p>
              <p className="font-bold text-[#4285F4]">{data.api_calls}</p>
            </div>
          )}
          {id && (
            <div className="flex gap-2 border-l border-[#E8EAED] pl-3">
              <button
                onClick={() => {
                  setDownloading("xlsx");
                  downloadCandidateReport(id, "xlsx").catch((err) => setError(err instanceof Error ? err.message : "Download failed.")).finally(() => setDownloading(null));
                }}
                disabled={!!downloading}
                className="px-3 py-1.5 rounded-lg border border-[#DADCE0] text-[#202124] text-sm font-medium hover:bg-[#F8F9FA] disabled:opacity-60 flex items-center gap-1.5"
              >
                {downloading === "xlsx" ? "…" : "📊"} Excel
              </button>
              <button
                onClick={() => {
                  setDownloading("pdf");
                  downloadCandidateReport(id, "pdf").catch((err) => setError(err instanceof Error ? err.message : "Download failed.")).finally(() => setDownloading(null));
                }}
                disabled={!!downloading}
                className="px-3 py-1.5 rounded-lg border border-[#DADCE0] text-[#202124] text-sm font-medium hover:bg-[#F8F9FA] disabled:opacity-60 flex items-center gap-1.5"
              >
                {downloading === "pdf" ? "…" : "📄"} PDF
              </button>
            </div>
          )}
        </div>
      </div>
      <AnalysisResults result={data} />
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  );
}
