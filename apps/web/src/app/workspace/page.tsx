"use client";

/* Workspace is now the third segment of /findings (?view=workspace). This
   route only preserves old links: `/workspace` and `/workspace?ts=…` still
   land the reader in the right place. */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Redirect() {
  const router = useRouter();
  const params = useSearchParams();
  const ts = params.get("ts");
  useEffect(() => {
    router.replace(ts ? `/findings?view=workspace&ts=${encodeURIComponent(ts)}` : "/findings?view=workspace");
  }, [router, ts]);
  return null;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
