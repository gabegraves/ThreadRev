"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { SegmentedChips } from "@/civic-ui/components/FilterChips";
import { FindingsExplorer } from "@/components/findings/findings-explorer";
import { ThreadBody } from "@/components/thread/thread-body";
import { WorkspaceBody } from "@/components/workspace/workspace-body";

type View = "findings" | "messages" | "workspace";

const VIEW_HREF: Record<View, string> = {
  findings: "/findings",
  messages: "/findings?view=messages",
  workspace: "/findings?view=workspace",
};

const VIEW_BLURB: Record<View, string> = {
  findings: "Every card Rev published, across recorded threads.",
  messages: "The selected thread in order, with what each message triggered.",
  workspace: "The reviewer's exact-match message index.",
};

function Body() {
  const router = useRouter();
  const params = useSearchParams();
  const rawView = params.get("view");
  const view: View = rawView === "messages" ? "messages" : rawView === "workspace" ? "workspace" : "findings";
  const setView = useCallback((v: View) => router.replace(VIEW_HREF[v], { scroll: false }), [router]);
  return (
    <>
      {/* Findings = what Rev concluded, across every recorded thread.
          Messages = the selected thread in order, with what each message triggered.
          Workspace = the reviewer's exact-match message index. */}
      <div className="flex items-center gap-3 border-b border-hairline px-3 py-2 sm:px-4 lg:px-6">
        <SegmentedChips
          options={[
            { value: "findings", label: "Findings" },
            { value: "messages", label: "Messages" },
            { value: "workspace", label: "Workspace" },
          ]}
          value={view}
          onChange={setView}
        />
        <span className="text-[12px] text-faint">{VIEW_BLURB[view]}</span>
      </div>
      {view === "messages" ? <ThreadBody /> : view === "workspace" ? <WorkspaceBody /> : <FindingsExplorer />}
    </>
  );
}

export default function Page() {
  return (
    // Full-bleed: the grid owns the entire content area (toolbar padding lives
    // inside WorkOrderGrid). The layout's container padding (px-3/sm:px-4/lg:px-6,
    // pt-city-content, pb-10) is pulled back with matching negative margins.
    // Height is 100dvh divided back out of the html `zoom: 0.8` (--app-zoom):
    // dvh resolves BEFORE the zoom scales it, so a plain h-dvh renders at 80%.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      <h1 className="sr-only">Findings</h1>
      <Suspense fallback={<p className="p-4 text-[13px] text-subtle">Loading findings…</p>}>
        <Body />
      </Suspense>
    </div>
  );
}
