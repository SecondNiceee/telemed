"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveBackDelta, toPath } from "@/lib/navigation-history";

/**
 * Кнопка «Назад».
 *
 * По умолчанию — обычный history.back(). Если передан skipPaths, кнопка
 * отматывает историю дальше, пропуская записи, которые по логике сайта находятся
 * *вперёд* (например /doctor/{id} при возврате со страницы категории), а также
 * дубликаты текущей страницы. То есть вместо -1 уходит на -2, -3 и т.д.
 *
 * fallbackHref нужен, когда истории нет (прямая ссылка, новая вкладка) или когда
 * все предыдущие записи оказались «пропускаемыми».
 */
export function BackButton({
  fallbackHref = "/",
  label = "Назад",
  className,
  skipPaths,
  skipSelf = true,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
  /** Префиксы путей, которые нужно пропускать при возврате, напр. ["/doctor"]. */
  skipPaths?: string[];
  /** Пропускать записи с тем же путём, что и текущая страница. */
  skipSelf?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = () => {
    if (typeof window === "undefined") return;

    const hasHistory = window.history.length > 1;
    const needsSmartBack = (skipPaths && skipPaths.length > 0) || skipSelf;

    if (hasHistory && needsSmartBack) {
      const delta = resolveBackDelta(({ path }) => {
        if (skipSelf && path === toPath(pathname)) return true;
        return (skipPaths ?? []).some(
          (prefix) => path === prefix || path.startsWith(`${prefix}/`),
        );
      });

      if (delta !== null) {
        window.history.go(delta);
        return;
      }

      // Подходящей записи в истории нет — уходим на «родительскую» страницу.
      router.push(fallbackHref);
      return;
    }

    if (hasHistory) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        "rounded-full text-teal hover:bg-teal/10 hover:text-teal",
        className,
      )}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
