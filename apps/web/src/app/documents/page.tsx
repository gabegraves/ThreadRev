"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Drawer } from "@/civic-ui/components/Drawer";
import { DocumentDetailBody, DocumentDetailPanel } from "@/components/documents/document-detail";
import { buildDocumentRows, useIsLg } from "@/components/documents/document-model";
import { DocumentsTable } from "@/components/documents/documents-table";
import { PageHeader } from "@/components/shell/page-header";
import { useEvidence } from "@/lib/demo/use-evidence";

export default function Page() {
  const router = useRouter();
  const { events, graph, loaded } = useEvidence();
  const rows = useMemo(() => buildDocumentRows(events, graph), [events, graph]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const isLg = useIsLg();
  const onOpenFinding = useCallback((id: string) => router.push(`/findings?id=${encodeURIComponent(id)}`), [router]);
  const close = useCallback(() => setSelectedId(null), []);

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Every file the reviewer read, keyed by the sha256 of the exact bytes. A finding can only cite a digest that appears here."
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DocumentsTable rows={rows} loading={!loaded} selectedId={selectedId} onSelect={(r) => setSelectedId(r.id)} />
        <div className="hidden lg:block">
          <DocumentDetailPanel row={selected} onOpenFinding={onOpenFinding} />
        </div>
      </div>
      {!isLg && selected && (
        <Drawer open onClose={close} title={selected.document}>
          <div className="flex flex-col gap-4">
            <DocumentDetailBody row={selected} onOpenFinding={onOpenFinding} />
          </div>
        </Drawer>
      )}
    </>
  );
}
