"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/civic-ui/lib/cn";
import { ScenarioSwitcher } from "./scenario-switcher";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { label: "Overview", href: "/" },
  { label: "Thread", href: "/thread" },
  { label: "Documents", href: "/documents" },
  { label: "Findings", href: "/findings" },
  { label: "Graph", href: "/graph" },
  { label: "Runs", href: "/runs" },
  { label: "Analytics", href: "/analytics" },
  { label: "Chat", href: "/chat" },
];

/** Below md the rail is gone; this sticky two-row header carries brand, scenario and a scrolling tab strip. */
export function MobileHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-glass backdrop-blur md:hidden">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <Link href="/" className="text-[17px] font-semibold tracking-tight text-foreground">
          ThreadRev
        </Link>
        <div className="min-w-0 flex-1">
          <ScenarioSwitcher />
        </div>
        <ThemeToggle className="h-9 w-9 shrink-0" />
      </div>
      <nav aria-label="Sections" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                active ? "bg-elevated text-foreground" : "text-subtle hover:bg-overlay hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
