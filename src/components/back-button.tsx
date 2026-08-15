"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Кнопка «Назад»: возвращает на предыдущую страницу через history.back().
 *
 * fallbackHref нужен для случая, когда истории нет (переход по прямой ссылке,
 * открытие в новой вкладке) — тогда router.back() никуда не ведёт и юзер
 * остаётся на месте. Определяем это по длине history.
 */
export function BackButton({
  fallbackHref = "/",
  label = "Назад",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
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
