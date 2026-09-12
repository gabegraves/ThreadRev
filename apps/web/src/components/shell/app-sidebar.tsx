"use client";

import { BarChart3, FileText, GitBranch, LayoutDashboard, MessageSquare, PlayCircle, ShieldCheck } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { SidebarNav, SidebarShell, SidebarWhenCollapsed, SidebarWhenExpanded } from "@/civic-ui/components/SidebarShell";
import { useEvidence } from "@/lib/demo/use-evidence";
import { ScenarioSwitcher } from "./scenario-switcher";
import { RailFooterCollapsed, RailFooterExpanded } from "./rail-footer";

export function AppSidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view");
  const kind = params.get("kind");
  const { graph, events } = useEvidence();
  const live = graph.findings.filter((f) => f.status === "live").length;
  const docs = new Set(events.filter((e) => e.kind === "document_read").map((e) => (e as { sha256: string }).sha256)).size;
  const runs = events.filter((e) => e.kind === "check_run").length;
  const is = (p: string) => (p === "/" ? pathname === "/" : pathname?.startsWith(p) ?? false);

  const review = [
    { label: "Overview", href: "/", icon: LayoutDashboard, active: is("/") },
    {
      label: "Documents",
      href: "/documents",
      icon: FileText,
      active: is("/documents"),
      count: docs,
      sub: [
        { label: "Files", href: "/documents", active: is("/documents") && kind !== "chats" },
        { label: "Chats", href: "/documents?kind=chats", active: is("/documents") && kind === "chats" },
      ],
    },
    {
      label: "Findings",
      href: "/findings",
      icon: ShieldCheck,
      active: is("/findings"),
      count: live,
      sub: [
        { label: "Findings", href: "/findings", active: is("/findings") && !view },
        { label: "Messages", href: "/findings?view=messages", active: is("/findings") && view === "messages" },
        { label: "Workspace", href: "/findings?view=workspace", active: is("/findings") && view === "workspace" },
      ],
    },
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
            <RailFooterExpanded />
          </SidebarWhenExpanded>
          <SidebarWhenCollapsed>
            <RailFooterCollapsed />
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
