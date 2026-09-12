import { TrendingDown, TrendingUp } from "lucide-react";
import { memo } from "react";
import { cn } from "../lib/cn";

/* Extracted from Civic src/components/dashboard/stats-cards.tsx. The Civic
   original took a `CityStats` row and derived the week-over-week delta inline;
   here the caller passes finished `cards` so the component is presentational.
   Everything below the props boundary is the Civic recipe unchanged. */

export interface StatCardDef {
  label: string;
  value: string;
  trend?: { direction: "up" | "down"; label: string; tone: "good" | "bad" };
}

interface StatsCardsProps {
  /** Four cells is the designed shape (2-col mobile → 4-col desktop row). */
  cards: StatCardDef[];
}

// Per-index divider classes: 2-col mobile grid → 4-col desktop row.
// Cells share one hairline-bordered surface; dividers, not gaps.
const BORDER_CLASSES = [
  "border-r border-b lg:border-b-0 border-hairline",
  "border-b lg:border-b-0 lg:border-r border-hairline",
  "border-r border-hairline",
  "",
];

function StatsCardsInner({ cards }: StatsCardsProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-hairline bg-surface overflow-hidden shadow-[var(--shadow-card)]">
      <style>{`
@keyframes stat-roll{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.stat-val{animation:stat-roll 260ms cubic-bezier(0.22,1,0.36,1) both}
@media (prefers-reduced-motion:reduce){.stat-val{animation:none}}
`}</style>
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {cards.map((card, idx) => (
          <div
            key={card.label}
            className={cn(
              "px-4 py-4 sm:px-5 sm:py-5 min-h-[80px] transition-colors hover:bg-overlay",
              BORDER_CLASSES[idx % BORDER_CLASSES.length],
            )}
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              {/* Mono micro-label convention for stat captions. */}
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint leading-none">
                {card.label}
              </span>
              {card.trend && (
                <span
                  // role="img" so the aria-label (generic role drops it) is
                  // honored and replaces the raw "12%" text with the full
                  // phrase for screen readers.
                  role="img"
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    // Pastel delta chip: soft fill carries the tone, strong
                    // variant carries the (AA-tuned) figure. Tone, not arrow
                    // direction, picks the pair.
                    card.trend.tone === "good"
                      ? "bg-pastel-mint text-pastel-mint-strong"
                      : "bg-pastel-blush text-pastel-blush-strong",
                  )}
                  aria-label={`${card.trend.direction === "up" ? "Up" : "Down"} ${card.trend.label}`}
                >
                  {card.trend.direction === "up" ? (
                    <TrendingUp
                      className="h-3 w-3"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <TrendingDown
                      className="h-3 w-3"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                  {card.trend.label}
                </span>
              )}
            </div>
            <p
              // key on the value re-mounts the node when the number changes,
              // re-firing the brief rise animation; static between filter swaps.
              key={card.value}
              className="stat-val text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground"
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const StatsCards = memo(StatsCardsInner);
