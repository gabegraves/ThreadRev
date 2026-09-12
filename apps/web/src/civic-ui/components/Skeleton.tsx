import { cn } from "../lib/cn";

/* Loading placeholders. The shimmer itself lives in theme.css as the
   `.skeleton` class (Civic globals.css) — a diagonal highlight sweeping a
   neutral surface, compositor-friendly, reduced-motion aware. These are just
   the shapes Civic's route loading.tsx shells compose from.

   `.skeleton` sets `border-radius: inherit` inside @layer components, so a
   `rounded-*` utility on the same element still wins. */

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("skeleton block", className)} aria-hidden />;
}

/** Four-cell stat strip placeholder — matches StatsCards' bordered surface. */
export function StatsCardsSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-surface shadow-[var(--shadow-card)]"
      role="status"
      aria-label="Loading statistics"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-h-[80px] px-4 py-4 sm:px-5 sm:py-5 border-hairline [&:nth-child(1)]:border-r [&:nth-child(1)]:border-b [&:nth-child(2)]:border-b [&:nth-child(3)]:border-r lg:[&:nth-child(1)]:border-b-0 lg:[&:nth-child(2)]:border-b-0 lg:[&:nth-child(2)]:border-r"
          >
            <Skeleton className="mb-2.5 h-2.5 w-20 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-7 w-16 rounded-[var(--radius-sm)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bento tile placeholder. */
export function TileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5",
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-3 w-28 rounded-[var(--radius-sm)]" />
      <Skeleton className="h-32 w-full rounded-[var(--radius-md)]" />
    </div>
  );
}
