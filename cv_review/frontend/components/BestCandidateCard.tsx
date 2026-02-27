import Link from "next/link";
import type { Area, BestCandidates } from "@/lib/types";
import { AREA_COLORS, AREA_BG, LEVEL_COLORS, LEVEL_BG, AREAS } from "@/lib/types";

type Candidate = NonNullable<BestCandidates["best_by_area"][Area]>;

interface Props {
  candidate: Candidate;
  area: Area;
}

export default function BestCandidateCard({ candidate, area }: Props) {
  const areaScore = candidate.area_scores?.[area] ?? 0;
  const color = AREA_COLORS[area];
  const bg = AREA_BG[area];

  return (
    <div className="border rounded-xl p-5" style={{ borderColor: color + "30", backgroundColor: bg }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <Link
            href={`/analysis?id=${candidate.id}`}
            className="font-bold text-[#202124] hover:underline text-base"
          >
            {candidate.filename}
          </Link>
          <p className="text-sm text-[#9AA0A6] mt-0.5">
            {new Date(candidate.timestamp).toLocaleDateString()}
          </p>
        </div>
        <div className="text-center shrink-0">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl text-white"
            style={{ backgroundColor: color }}
          >
            {areaScore.toFixed(1)}
          </div>
          <p className="text-xs text-[#5F6368] mt-1">/ 5.0</p>
        </div>
      </div>

      {/* Summary */}
      {candidate.candidate_summary && (
        <p className="text-sm text-[#3C4043] leading-relaxed mb-4 line-clamp-3">
          {candidate.candidate_summary}
        </p>
      )}

      {/* Specializations */}
      {candidate.best_specializations?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {candidate.best_specializations.slice(0, 3).map((s, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: LEVEL_BG[s.level], color: LEVEL_COLORS[s.level] }}
            >
              {s.specialization} · {s.level}
            </span>
          ))}
        </div>
      )}

      {/* All area mini scores */}
      <div className="flex gap-2 flex-wrap">
        {AREAS.map((a) => (
          <div key={a} className="flex items-center gap-1 text-xs">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: AREA_COLORS[a] }}
            />
            <span className="text-[#5F6368]">{a.slice(0, 4)}</span>
            <span className="font-medium" style={{ color: AREA_COLORS[a] }}>
              {(candidate.area_scores?.[a] ?? 1).toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <Link
        href={`/analysis?id=${candidate.id}`}
        className="mt-4 text-sm font-medium hover:underline flex items-center gap-1"
        style={{ color }}
      >
        View full analysis →
      </Link>
    </div>
  );
}
