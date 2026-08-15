"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Локальная дата в YYYY-MM-DD. Через toISOString нельзя — он уводит в UTC и на
 *  вечерних таймзонах даёт предыдущий день. */
export function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Начало недели (понедельник) для переданной даты. */
function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

interface DateFilterProps {
  /** Выбранная дата в формате YYYY-MM-DD, либо null. */
  value: string | null;
  onChange: (date: string | null) => void;
  /** Подпись под заголовком, когда дата не выбрана. */
  hint?: string;
}

export function DateFilter({
  value,
  onChange,
  hint = "Выберите дату, чтобы найти доступных врачей",
}: DateFilterProps) {
  // Если дата уже выбрана (например, пришла из URL), раскрываем сразу —
  // иначе активный фильтр выглядит спрятанным.
  const [isOpen, setIsOpen] = useState(Boolean(value));
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(value ? new Date(`${value}T00:00:00`) : new Date()),
  );

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  }, [weekStart]);

  const shiftWeek = (deltaDays: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + deltaDays);
    setWeekStart(next);
  };

  const formatMonthYear = () => {
    const [first] = weekDays;
    const last = weekDays[6];
    if (first.getMonth() === last.getMonth()) {
      return first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    }
    return `${first.toLocaleDateString("ru-RU", { month: "short" })} — ${last.toLocaleDateString(
      "ru-RU",
      { month: "short", year: "numeric" },
    )}`;
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const todayStr = toDateStr(new Date());

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
          isOpen || value
            ? "border-teal/45 bg-teal/[0.07]"
            : "border-teal/20 bg-card/80 hover:border-teal/40 hover:bg-teal/[0.05]",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              value ? "bg-teal text-teal-foreground" : "bg-teal/10 text-teal",
            )}
          >
            <Calendar className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Фильтр по дате</p>
            {value ? (
              <p className="text-xs font-medium text-teal">
                {new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {value && (
            // Сброс внутри кнопки-тоггла: останавливаем всплытие, чтобы
            // очистка даты не сворачивала/разворачивала панель.
            <span
              role="button"
              tabIndex={0}
              aria-label="Сбросить дату"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-teal hover:bg-teal/15"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-5 h-5 text-teal transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0",
        )}
      >
        <Card className="border-teal/20 bg-card/80">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Предыдущая неделя"
                onClick={() => shiftWeek(-7)}
                className="rounded-full text-teal hover:bg-teal/10 hover:text-teal"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h3 className="text-sm font-medium text-muted-foreground capitalize">
                {formatMonthYear()}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Следующая неделя"
                onClick={() => shiftWeek(7)}
                className="rounded-full text-teal hover:bg-teal/10 hover:text-teal"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((date) => {
                const dateStr = toDateStr(date);
                const past = isPast(date);
                const selected = value === dateStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => onChange(selected ? null : dateStr)}
                    disabled={past}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-center p-2 sm:p-3 rounded-xl transition-all",
                      selected
                        ? "bg-teal text-teal-foreground shadow-sm"
                        : past
                          ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                          : dateStr === todayStr
                            ? "bg-teal/15 text-teal hover:bg-teal/25"
                            : "bg-teal/[0.06] text-foreground hover:bg-teal/15",
                    )}
                  >
                    <span className="text-xs uppercase mb-1">
                      {date.toLocaleDateString("ru-RU", { weekday: "short" })}
                    </span>
                    <span className="text-base sm:text-lg font-semibold">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
