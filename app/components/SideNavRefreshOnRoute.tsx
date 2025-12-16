// app/components/SideNavRefreshOnRoute.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Erzwingt ein router.refresh() bei Navigation.
 * Ohne useSearchParams(), damit next build nicht wegen Suspense-Boundary scheitert.
 */
export default function SideNavRefreshOnRoute() {
  const router = useRouter();
  const pathname = usePathname();

  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Initial mount: nicht refreshen
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }

    // Nur refreshen, wenn sich die Route wirklich geändert hat
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      router.refresh();
    }
  }, [pathname, router]);

  return null;
}
