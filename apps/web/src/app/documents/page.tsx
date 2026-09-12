"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { DocumentDetailBody, DocumentDetailPanel } from "@/components/documents/document-detail";
import { buildDocumentRows, useIsLg } from "@/components/documents/document-model";
import { DocumentsTable } from "@/components/documents/documents-table";
import { PageHeader } from "@/components/shell/page-header";
import { useEvidence } from "@/lib/demo/use-evidence";

function DocumentsBody() {
  const router = useRouter();
  const params = useSearchParams();
  const { events, graph, loaded } = useEvidence();
  const rows = useMemo(() => buildDocumentRows(events, graph), [events, graph]);
  const graphNodeIds = useMemo(() => new Set(graph.nodes.map((n) => n.id)), [graph]);

  // `picked` is an explicit choice (row click or `?id=`); with none, the first
  // row fills the desktop panel but never pops the mobile Drawer.
  const paramId = params.get("id");
  const [picked, setPicked] = useState<string | null>(paramId);
  useEffect(() => setPicked(paramId), [paramId]);
  const selectedId = picked ?? rows[0]?.id ?? null;
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  // useIsLg is false until its effect runs, so a desktop deep link would flash
  // the Drawer for one frame without the mounted gate.
  const isLg = useIsLg();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const select = useCallback(
    (id: string) => {
      setPicked(id);
      router.replace(`/documents?id=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router],
  );
  const close = useCallback(() => {
    setPicked(null);
    router.replace("/documents", { scroll: false });
  }, [router]);

  return (
    <>
      <PageHeader title="Documents" subtitle="Which exact bytes a claim quotes." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DocumentsTable rows={rows} loading={!loaded} selectedId={selectedId} onSelect={(r) => select(r.id)} />
        <div className="hidden lg:block">
          <DocumentDetailPanel row={selected} graphNodeIds={graphNodeIds} />
        </div>
      </div>
      {mounted && !isLg && picked && selected && (
        <Drawer open onClose={close} title={selected.document}>
          <div className="flex flex-col gap-4">
            <DocumentDetailBody row={selected} graphNodeIds={graphNodeIds} />
          </div>
        </Drawer>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-[13px] text-subtle">Loading documents…</p>}>
      <DocumentsBody />
    </Suspense>
  );
}
