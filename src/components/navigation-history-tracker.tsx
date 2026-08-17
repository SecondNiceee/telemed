"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordNavigation } from "@/lib/navigation-history";

function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    recordNavigation(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
}

/**
 * Пишет каждый переход в собственный стек истории (см. lib/navigation-history).
 * Нужен для «умной» кнопки «Назад», которая пропускает страницы, находящиеся
 * вперёд по логике сайта.
 */
export function NavigationHistoryTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
