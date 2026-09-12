"use client";

import { BarChart3, FileText, GitBranch, LayoutDashboard, MessageSquare, MessagesSquare, PlayCircle, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarNav, SidebarShell, SidebarWhenCollapsed, SidebarWhenExpanded } from "@/civic-ui/components/SidebarShell";
import { useEvidence } from "@/lib/demo/use-evidence";
import { ScenarioSwitcher } from "./scenario-switcher";
import { ThemeToggle } from "./theme-toggle";

export function AppSidebar() {
  const pathname = usePathname();
  const { graph, events } = useEvidence();
  const live = graph.findings.filter((f) => f.status === "live").length;
  const docs = new Set(events.filter((e) => e.kind === "document_read").map((e) => (e as { sha256: string }).sha256)).size;
  const runs = events.filter((e) => e.kind === "check_run").length;
  const is = (p: string) => (p === "/" ? pathname === "/" : pathname?.startsWith(p) ?? false);

  const review = [
    { label: "Overview", href: "/", icon: LayoutDashboard, active: is("/") },
    { label: "Thread", href: "/thread", icon: MessagesSquare, active: is("/thread") },
    { label: "Documents", href: "/documents", icon: FileText, active: is("/documents"), count: docs },
    { label: "Findings", href: "/findings", icon: ShieldCheck, active: is("/findings"), count: live },
  ];
  const analysis = [
    { label: "Evidence graph", href: "/graph", icon: GitBranch, active: is("/graph") },
    { label: "Checker runs", href: "/runs", icon: PlayCircle, active: is("/runs"), count: runs },
    { label: "Analytics", href: "/analytics", icon: BarChart3, active: is("/analytics") },
  ];
  const assist = [{ label: "Chat", href: "/chat", icon: MessageSquare, active: is("/chat") }];

  return (
    <SidebarShell
      context={<ScenarioSwitcher />}
      footer={
        <>
          <SidebarWhenExpanded>
            <ThemeToggle className="h-8 w-full" />
          </SidebarWhenExpanded>
          <SidebarWhenCollapsed>
            <ThemeToggle className="h-9 w-full" />
          </SidebarWhenCollapsed>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <SidebarNav heading="Review" items={review} />
        <SidebarNav heading="Analysis" items={analysis} />
        <SidebarNav heading="Assist" items={assist} />
      </div>
    </SidebarShell>
  );
}
