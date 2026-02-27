"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMetrics, getBestCandidates, listAnalyses, deleteAnalysis, downloadCandidatesReport, downloadCandidateReport } from "@/lib/api";
import type { Metrics, BestCandidates, AnalysisRecord } from "@/lib/types";
import { AREAS, AREA_COLORS, AREA_BG } from "@/lib/types";
import MetricCard from "@/components/MetricCard";
import AreaDistributionChart from "@/components/AreaDistributionChart";
import AITimeChart from "@/components/AITimeChart";
import BestCandidateCard from "@/components/BestCandidateCard";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [best, setBest] = useState<BestCandidates | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState(AREAS[0]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<string>("");
  const [reportDateFrom, setReportDateFrom] = useState<string>("");
  const [reportDateTo, setReportDateTo] = useState<string>("");
  const [reportDownloading, setReportDownloading] = useState<"xlsx" | "pdf" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, b, a] = await Promise.all([getMetrics(), getBestCandidates(), listAnalyses(100)]);
      setMetrics(m);
      setBest(b);
      setAnalyses(a.items);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this analysis?")) return;
    setDeleting(id);
    try {
      await deleteAnalysis(id);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      load(); // refresh metrics
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const hasData = (metrics?.total_analyses ?? 0) > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#202124]">Dashboard</h1>
          <p className="text-[#5F6368] mt-1">Recruitment analytics & CV analysis history</p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 bg-[#4285F4] text-white rounded-lg font-medium text-sm hover:bg-[#3367D6] transition-colors shadow-sm"
        >
          + New Analysis
        </Link>
      </div>

      {!hasData ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-[#202124] mb-2">No analyses yet</h2>
          <p className="text-[#5F6368] mb-6">Upload and evaluate a CV to see your dashboard.</p>
          <Link
            href="/"
            className="px-6 py-3 bg-[#4285F4] text-white rounded-lg font-medium hover:bg-[#3367D6] transition-colors"
          >
            Analyze First CV
          </Link>
        </div>
      ) : (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon="📋"
              label="CVs Analyzed"
              value={metrics!.total_analyses.toString()}
              subtitle="Total evaluations"
              color="#4285F4"
              bg="#E8F0FE"
            />
            <MetricCard
              icon="⏱️"
              label="Human Hours Saved"
              value={`${(metrics!.total_human_time_saved_minutes / 60).toFixed(1)}h`}
              subtitle={`vs ${metrics!.human_review_minutes_per_cv} min/CV manual`}
              color="#34A853"
              bg="#E6F4EA"
            />
            <MetricCard
              icon="🤖"
              label="Avg AI Time"
              value={`${metrics!.avg_analysis_time_seconds.toFixed(0)}s`}
              subtitle={`Min ${metrics!.min_analysis_time_seconds}s · Max ${metrics!.max_analysis_time_seconds}s`}
              color="#FBBC04"
              bg="#FEF9E7"
            />
            <MetricCard
              icon="⚡"
              label="Total API Calls"
              value={metrics!.total_api_calls.toLocaleString()}
              subtitle={`${metrics!.total_tokens.toLocaleString()} tokens used`}
              color="#EA4335"
              bg="#FCE8E6"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card p-6">
              <h3 className="font-bold text-[#202124] mb-4">CVs by Best-Fit Area</h3>
              <AreaDistributionChart data={metrics!.analyses_by_area} />
            </div>
            <div className="card p-6">
              <h3 className="font-bold text-[#202124] mb-1">AI Analysis Time Trend</h3>
              <p className="text-xs text-[#9AA0A6] mb-4">Seconds per analysis (last 30)</p>
              <AITimeChart data={metrics!.recent_times} />
            </div>
          </div>

          {/* Human time savings visual */}
          <div className="card p-6 mb-8">
            <h3 className="font-bold text-[#202124] mb-2">⏱️ Time Saved vs Human Review</h3>
            <p className="text-sm text-[#5F6368] mb-4">
              A skilled recruiter needs ~{metrics!.human_review_minutes_per_cv} min to manually evaluate a CV
              against all specializations. AI does it in{" "}
              <span className="font-semibold text-[#34A853]">
                {metrics!.avg_analysis_time_seconds.toFixed(0)}s
              </span>{" "}
              on average.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-[#EA4335]">Human ({metrics!.human_review_minutes_per_cv} min)</span>
                  <span className="text-[#EA4335]">100%</span>
                </div>
                <div className="h-4 rounded-full bg-[#FCE8E6] overflow-hidden">
                  <div className="h-full rounded-full bg-[#EA4335] w-full" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-[#34A853]">
                    AI ({(metrics!.avg_analysis_time_seconds / 60).toFixed(1)} min)
                  </span>
                  <span className="text-[#34A853]">
                    {((metrics!.avg_analysis_time_seconds / 60 / metrics!.human_review_minutes_per_cv) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-4 rounded-full bg-[#E6F4EA] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#34A853]"
                    style={{
                      width: `${Math.min(100, (metrics!.avg_analysis_time_seconds / 60 / metrics!.human_review_minutes_per_cv) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-center mt-3 text-sm font-semibold text-[#34A853]">
              🚀 {metrics!.avg_human_time_saved_minutes.toFixed(0)} min saved per CV — {" "}
              {(metrics!.total_human_time_saved_minutes / 60).toFixed(1)} hours total
            </p>
          </div>

          {/* Best candidates per area */}
          <div className="card p-6 mb-8">
            <h3 className="font-bold text-[#202124] mb-4">🏆 Best Candidates per Area</h3>
            <div className="flex gap-2 mb-5 flex-wrap">
              {AREAS.map((area) => (
                <button
                  key={area}
                  onClick={() => setActiveArea(area)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeArea === area
                      ? "text-white"
                      : "text-[#5F6368] bg-[#F1F3F4] hover:bg-[#E8EAED]"
                  }`}
                  style={activeArea === area ? { backgroundColor: AREA_COLORS[area] } : {}}
                >
                  {area}
                </button>
              ))}
            </div>
            {best?.best_by_area[activeArea] ? (
              <BestCandidateCard
                candidate={best.best_by_area[activeArea]!}
                area={activeArea}
              />
            ) : (
              <div className="text-center py-8 text-[#9AA0A6]">
                <div className="text-3xl mb-2">👤</div>
                <p>No candidates evaluated for {activeArea} yet</p>
              </div>
            )}
          </div>

          {/* AI model usage */}
          <div className="card p-6 mb-8">
            <h3 className="font-bold text-[#202124] mb-4">🤖 AI Model Usage</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metrics!.analyses_by_model).map(([model, count]) => (
                <div key={model} className="bg-[#F8F9FA] rounded-xl p-4 text-center border border-[#E8EAED]">
                  <p className="text-2xl font-bold text-[#4285F4]">{count}</p>
                  <p className="text-sm font-medium text-[#202124] mt-1 truncate">{model}</p>
                  <p className="text-xs text-[#9AA0A6]">analyses</p>
                </div>
              ))}
              <div className="bg-[#F8F9FA] rounded-xl p-4 text-center border border-[#E8EAED]">
                <p className="text-2xl font-bold text-[#34A853]">
                  {(metrics!.total_api_calls / Math.max(1, metrics!.total_analyses)).toFixed(1)}
                </p>
                <p className="text-sm font-medium text-[#202124] mt-1">API calls / CV</p>
                <p className="text-xs text-[#9AA0A6]">avg per analysis</p>
              </div>
              {metrics!.total_tokens > 0 && (
                <div className="bg-[#F8F9FA] rounded-xl p-4 text-center border border-[#E8EAED]">
                  <p className="text-2xl font-bold text-[#FBBC04]">
                    {(metrics!.total_tokens / Math.max(1, metrics!.total_analyses)).toFixed(0)}
                  </p>
                  <p className="text-sm font-medium text-[#202124] mt-1">Tokens / CV</p>
                  <p className="text-xs text-[#9AA0A6]">avg per analysis</p>
                </div>
              )}
            </div>
          </div>

          {/* Download report (filtered) */}
          <div className="card p-6 mb-6">
            <h3 className="font-bold text-[#202124] mb-3">📥 Download report</h3>
            <p className="text-sm text-[#5F6368] mb-4">
              High-level candidate summary for decision making (Excel or PDF). Filter by area and/or date range.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-[#5F6368]">Area:</label>
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                  className="rounded-lg border border-[#DADCE0] px-3 py-2 text-sm text-[#202124] bg-white min-w-[140px]"
                >
                  <option value="">All</option>
                  {AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-[#5F6368]">From date:</label>
                <input
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="rounded-lg border border-[#DADCE0] px-3 py-2 text-sm text-[#202124] bg-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-[#5F6368]">To date:</label>
                <input
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="rounded-lg border border-[#DADCE0] px-3 py-2 text-sm text-[#202124] bg-white"
                />
              </div>
              <button
                onClick={() => {
                  setReportDownloading("xlsx");
                  downloadCandidatesReport({
                    format: "xlsx",
                    area: reportFilter || undefined,
                    dateFrom: reportDateFrom || undefined,
                    dateTo: reportDateTo || undefined,
                  })
                    .catch((err) => alert(err instanceof Error ? err.message : "Download failed."))
                    .finally(() => setReportDownloading(null));
                }}
                disabled={!!reportDownloading || analyses.length === 0}
                className="px-4 py-2 rounded-lg bg-[#34A853] text-white text-sm font-medium hover:bg-[#2D8E47] disabled:opacity-60 flex items-center gap-1.5"
              >
                {reportDownloading === "xlsx" ? "…" : "📊"} Excel
              </button>
              <button
                onClick={() => {
                  setReportDownloading("pdf");
                  downloadCandidatesReport({
                    format: "pdf",
                    area: reportFilter || undefined,
                    dateFrom: reportDateFrom || undefined,
                    dateTo: reportDateTo || undefined,
                  })
                    .catch((err) => alert(err instanceof Error ? err.message : "Download failed."))
                    .finally(() => setReportDownloading(null));
                }}
                disabled={!!reportDownloading || analyses.length === 0}
                className="px-4 py-2 rounded-lg bg-[#EA4335] text-white text-sm font-medium hover:bg-[#D33426] disabled:opacity-60 flex items-center gap-1.5"
              >
                {reportDownloading === "pdf" ? "…" : "📄"} PDF
              </button>
            </div>
          </div>

          {/* Analysis history table */}
          <div className="card p-6">
            <h3 className="font-bold text-[#202124] mb-4">
              📁 Analysis History
              <span className="ml-2 text-sm text-[#9AA0A6] font-normal">({analyses.length} total)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8EAED] text-left">
                    <th className="pb-3 pr-4 text-[#5F6368] font-medium">File</th>
                    <th className="pb-3 pr-4 text-[#5F6368] font-medium">Date</th>
                    <th className="pb-3 pr-4 text-[#5F6368] font-medium">Best Fit</th>
                    <th className="pb-3 pr-4 text-[#5F6368] font-medium">AI Time</th>
                    <th className="pb-3 pr-4 text-[#5F6368] font-medium">API Calls</th>
                    <th className="pb-3 text-[#5F6368] font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => (
                    <tr key={a.id} className="border-b border-[#F1F3F4] hover:bg-[#F8F9FA] transition-colors">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/analysis?id=${a.id}`}
                          className="font-medium text-[#4285F4] hover:underline truncate max-w-[160px] block"
                        >
                          {a.filename}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[#5F6368]">
                        {new Date(a.timestamp).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: AREA_BG[a.most_fitted_area as keyof typeof AREA_BG] || "#F1F3F4",
                            color: AREA_COLORS[a.most_fitted_area as keyof typeof AREA_COLORS] || "#5F6368",
                          }}
                        >
                          {a.most_fitted_area}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[#5F6368]">{a.analysis_time_seconds}s</td>
                      <td className="py-3 pr-4 text-[#5F6368]">{a.api_calls}</td>
                      <td className="py-3">
                        <div className="flex gap-2 flex-wrap">
                          <Link
                            href={`/analysis?id=${a.id}`}
                            className="text-[#4285F4] hover:underline text-xs"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => downloadCandidateReport(a.id, "xlsx").catch((err) => alert(err instanceof Error ? err.message : "Download failed."))}
                            className="text-[#34A853] hover:underline text-xs"
                          >
                            Excel
                          </button>
                          <button
                            onClick={() => downloadCandidateReport(a.id, "pdf").catch((err) => alert(err instanceof Error ? err.message : "Download failed."))}
                            className="text-[#EA4335] hover:underline text-xs"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deleting === a.id}
                            className="text-[#9AA0A6] hover:underline text-xs disabled:opacity-50"
                          >
                            {deleting === a.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
