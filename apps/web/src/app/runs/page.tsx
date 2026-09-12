"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { Skeleton } from "@/civic-ui/components/Skeleton";
import { useIsLg } from "@/components/documents/document-model";
import { PageHeader } from "@/components/shell/page-header";
import { RunDetail } from "@/components/runs/run-detail";
import { runRows, RunsTable } from "@/components/runs/runs-table";
import { useEvidence } from "@/lib/demo/use-evidence";

function Runs() {
  const router = useRouter();
  const params = useSearchParams();
  const { events, graph, loaded } = useEvidence();
  const isLg = useIsLg();
  const rows = useMemo(() => runRows(events), [events]);
  const listRef = useRef<HTMLElement>(null);

  // `?id=` → selection. Only external navigation (load, back / forward) lands
  // and scrolls the row; the page's own clicks write the URL through
  // selfPushedRef and must not scroll again.
  const paramId = params.get("id");
  const selfPushedRef = useRef<string | null>(paramId);
  const [picked, setPicked] = useState<string | null>(paramId);
  const [landId, setLandId] = useState<string | null>(paramId);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(paramId));
  useEffect(() => {
    if (paramId !== selfPushedRef.current) {
      selfPushedRef.current = paramId;
      setPicked(paramId);
      setLandId(paramId);
      setDrawerOpen(Boolean(paramId));
    }
  }, [paramId]);
  const select = useCallback(
    (id: string) => {
      setPicked(id);
      setDrawerOpen(true);
      selfPushedRef.current = id;
      router.replace(`/runs?id=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router],
  );

  // An unknown or absent id falls back to the newest run by `at`.
  const selected = useMemo(() => {
    const hit = picked ? rows.find((r) => r.run.run_id === picked) : undefined;
    if (hit) return hit;
    return rows.reduce<(typeof rows)[number] | null>((best, r) => (!best || r.run.at > best.run.at ? r : best), null);
  }, [rows, picked]);

  useEffect(() => {
    if (!landId) return;
    const tr = listRef.current?.querySelector('tr[aria-current="true"]');
    if (!tr) return;
    tr.scrollIntoView({ block: "center" });
    setLandId(null);
  }, [landId, rows]);

  const close = useCallback(() => setDrawerOpen(false), []);

  return (
    // Same full-bleed frame as findings/page.tsx: height is 100dvh divided back
    // out of the html zoom; the header sits inside so the body gets the rest.
    <div className="-mx-3 -mb-10 -mt-[calc(env(safe-area-inset-top)+8rem)] flex h-[calc(100dvh/var(--app-zoom,1)-5.5rem)] min-h-[480px] w-auto flex-col overflow-hidden sm:-mx-4 md:-mt-8 md:h-[calc(100dvh/var(--app-zoom,1))] lg:-mx-6">
      <div className="px-3 pt-4 pb-3 sm:px-4 lg:px-6">
        <PageHeader title="Checker runs" />
      </div>
      <div className="flex min-h-0 flex-1 border-t border-hairline">
        <section ref={listRef} className="custom-scrollbar flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4 lg:px-6">
          <RunsTable rows={rows} selected={selected?.run.run_id ?? null} onSelect={select} loading={!loaded} />
        </section>
        <aside className="custom-scrollbar hidden w-[380px] shrink-0 overflow-y-auto border-l border-hairline bg-surface lg:block">
          {!loaded ? (
            <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading run">
              <Skeleton className="h-4 w-48 rounded-[var(--radius-sm)]" />
              <Skeleton className="h-24 w-full rounded-[var(--radius-md)]" />
            </div>
          ) : (
            <RunDetail row={selected} graph={graph} className="min-h-full rounded-none border-0 shadow-none" />
          )}
        </aside>
      </div>
      {!isLg && drawerOpen && selected && (
        <Drawer open onClose={close} title={selected.run.run_id}>
          <RunDetail row={selected} graph={graph} className="rounded-none border-0 p-0 shadow-none sm:p-0" />
        </Drawer>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-[13px] text-subtle">Loading runs…</p>}>
      <Runs />
    </Suspense>
  );
}
