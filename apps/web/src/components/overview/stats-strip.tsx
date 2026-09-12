"use client";

import Link from "next/link";
import { cn } from "@/civic-ui/lib/cn";

/**
 * Civic's stats-cards recipe (one hairline surface, mono micro-label, 28px
 * tabular value, hover:bg-overlay) with each cell a Link. The civic-ui
 * StatsCards cannot carry an href, so the shell is rebuilt here; dividers come
 * from a 1px gap over the hairline colour instead of per-index border classes.
 */
export type LinkedStat = { label: string; value: string; href: string; hint?: string };

export function StatsStrip({ cards }: { cards: LinkedStat[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-hairline shadow-[var(--shadow-card)]">
      <style>{`
@keyframes stat-roll{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.stat-val{animation:stat-roll 260ms cubic-bezier(0.22,1,0.36,1) both}
@media (prefers-reduced-motion:reduce){.stat-val{animation:none}}
`}</style>
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={cn("block min-h-[80px] bg-surface px-4 py-4 transition-colors hover:bg-overlay focus-visible:outline-2 focus-visible:outline-accent sm:px-5 sm:py-5")}
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-faint">{card.label}</span>
              {card.hint && <span className="text-[12px] tabular-nums text-subtle">{card.hint}</span>}
            </div>
            <p key={card.value} className="stat-val text-2xl font-semibold leading-none tabular-nums text-foreground">
              {card.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
