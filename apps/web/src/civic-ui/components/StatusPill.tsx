import { cn } from "../lib/cn";
import { type StatusTone, toneChipClass } from "../lib/status";

/* Thin wrapper over lib/status.ts `toneChipClass`, matching how Civic renders
   its 19 status <span> consumers (recent-reports, reports-explorer,
   report-detail, delegation-panel, report-map). The hue lives on a `before:`
   pseudo dot; the label stays in the AA-tuned --status-*-fg token.

   Use Badge.tsx when you want the uppercase/tracked chip; use this when you
   want the plain-cased status label (the table / list register). */

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        toneChipClass(tone),
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
