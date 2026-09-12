"use client";

/** /thread merged into /findings?view=messages. Old deep links still land. */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Redirect() {
  const router = useRouter();
  const ts = useSearchParams().get("ts");
  useEffect(() => {
    router.replace(ts ? `/findings?view=messages&ts=${encodeURIComponent(ts)}` : "/findings?view=messages");
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
