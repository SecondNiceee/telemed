"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DoctorCard } from "@/components/doctor-card";
import { Search, X } from "lucide-react";
import type { ApiDoctor } from "@/lib/api/types";
import { DateFilter } from "@/components/date-filter";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  SORT_STORAGE_KEY,
  isDoctorSortOption,
  type DoctorRatingsMap,
  type DoctorSortOption,
} from "@/lib/utils/doctor-rating";

/** Сколько врачей показываем на одной странице */
const DOCTORS_PER_PAGE = 6;

interface CategoryPageClientProps {
  doctors: ApiDoctor[];
  ratings: DoctorRatingsMap;
  initialSelectedDate?: string;
}

export function CategoryPageClient ({ 
  doctors, 
  ratings,
  initialSelectedDate 
}: CategoryPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialSelectedDate ?? null,
  );
  const [page, setPage] = useState(1);
  // Стартуем с дефолта, а сохранённый выбор подхватываем уже в эффекте:
  // читать localStorage в инициализаторе нельзя — на сервере его нет,
  // и разметка разошлась бы с клиентской при гидратации.
  const [sortBy, setSortBy] = useState<DoctorSortOption>(DEFAULT_SORT);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (isDoctorSortOption(saved)) setSortBy(saved);
  }, []);

  const changeSort = useCallback((value: string) => {
    if (!isDoctorSortOption(value)) return;
    setSortBy(value);
    window.localStorage.setItem(SORT_STORAGE_KEY, value);
  }, []);

  // Дата живёт в state (фильтруем на клиенте), но дублируем её в URL, чтобы
  // ссылку можно было переслать и чтобы переход из /appointment с ?date= работал.
  // replace + scroll:false — чтобы не плодить историю и не прыгать к началу.
  const handleDateChange = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
      router.replace(date ? `${pathname}?date=${date}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // Сортируем один раз по всему списку — до фильтров. Поиск и дата только
  // выкидывают элементы, порядок не меняя, поэтому набор текста в поиске
  // не запускает пересортировку.
  const sortedDoctors = useMemo(() => {
    const byName = (a: ApiDoctor, b: ApiDoctor) =>
      (a.name ?? "").localeCompare(b.name ?? "", "ru");

    const result = [...doctors];

    if (sortBy === "rating") {
      return result.sort((a, b) => {
        const aRating = ratings[a.id];
        const bRating = ratings[b.id];
        const byAverage = (bRating?.average ?? 0) - (aRating?.average ?? 0);
        if (byAverage !== 0) return byAverage;
        // При равном балле выше тот, у кого он подтверждён большим числом отзывов
        const byCount = (bRating?.count ?? 0) - (aRating?.count ?? 0);
        return byCount !== 0 ? byCount : byName(a, b);
      });
    }

    const direction = sortBy === "price-asc" ? 1 : -1;
    return result.sort((a, b) => {
      // Врачи без цены всегда в конце — в обоих направлениях, иначе при
      // сортировке «сначала дороже» список начинался бы с пустых цен.
      if (a.price == null && b.price == null) return byName(a, b);
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price === b.price ? byName(a, b) : (a.price - b.price) * direction;
    });
  }, [doctors, ratings, sortBy]);

  // Filter doctors by search query and selected date
  const filteredDoctors = useMemo(() => {
    let result = sortedDoctors;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (doctor) =>
          (doctor.name && doctor.name.toLowerCase().includes(query)) ||
          (doctor.degree && doctor.degree.toLowerCase().includes(query)) ||
          (doctor.bio && doctor.bio.toLowerCase().includes(query))
      );
    }

    // Filter by selected date (check if doctor has available slot on that date)
    if (selectedDate) {
      result = result.filter((doctor) => {
        if (!doctor.schedule || !Array.isArray(doctor.schedule)) return false;
        
        return doctor.schedule.some((dayEntry) => {
          if (typeof dayEntry === 'object' && dayEntry !== null && 'date' in dayEntry) {
            const scheduleDay = dayEntry as { date: string; slots?: unknown[] };
            return (
              scheduleDay.date === selectedDate &&
              scheduleDay.slots &&
              scheduleDay.slots.length > 0
            );
          }
          return false;
        });
      });
    }

    return result;
  }, [sortedDoctors, searchQuery, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / DOCTORS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  // Список отфильтровался — страница из state может стать «мёртвой», подтягиваем её обратно
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  // Смена фильтров всегда возвращает к первой странице: иначе после сужения
  // выборки пользователь остаётся на странице, которой в новой выдаче нет.
  // Сортировка тоже сбрасывает — порядок меняется целиком, и «шестая страница»
  // прежнего списка ничего общего с новым не имеет.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedDate, sortBy]);

  const visibleDoctors = useMemo(() => {
    const start = (currentPage - 1) * DOCTORS_PER_PAGE;
    return filteredDoctors.slice(start, start + DOCTORS_PER_PAGE);
  }, [filteredDoctors, currentPage]);

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === currentPage) return;
    setPage(clamped);
    // Возвращаем к началу списка, чтобы не оказаться в середине новой страницы
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rangeStart = (currentPage - 1) * DOCTORS_PER_PAGE + 1;
  const rangeEnd = rangeStart + visibleDoctors.length - 1;

  return (
    <div>
      {/* Search and filter info */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-teal" />
          <Input
            type="text"
            placeholder="Поиск по врачам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-full border-teal/30 bg-card/80 focus-visible:border-teal focus-visible:ring-teal/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-teal hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date filter */}
        <DateFilter
          value={selectedDate}
          onChange={handleDateChange}
          hint="Выберите дату, чтобы найти врачей со свободными слотами"
        />

        {selectedDate && (
          <p className="text-sm text-muted-foreground">
            Показаны врачи, доступные на{" "}
            <span className="font-medium text-foreground">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
            </span>
          </p>
        )}

        {/* Count + sort */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="text-sm text-muted-foreground">
            Найдено врачей:{" "}
            <span className="inline-flex items-center rounded-full bg-teal/10 px-2.5 py-0.5 font-semibold text-teal">
              {filteredDoctors.length}
            </span>
            {searchQuery && ` по запросу "${searchQuery}"`}
          </p>

          <div className="flex items-center gap-2">
            <label
              htmlFor="doctors-sort"
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              Сортировка
            </label>
            <Select value={sortBy} onValueChange={changeSort}>
              <SelectTrigger
                id="doctors-sort"
                className="h-10 w-[218px] rounded-full border-teal/30 bg-card/80 focus-visible:border-teal focus-visible:ring-teal/20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Doctors list */}
      {filteredDoctors.length > 0 ? (
        <div ref={listRef} className="scroll-mt-28">
          <div className="grid gap-3">
            {visibleDoctors.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                rating={ratings[doctor.id] ?? null}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            ariaLabel="Пагинация по врачам"
            label={`${rangeStart}–${rangeEnd} из ${filteredDoctors.length} врачей`}
            className="mt-8 flex flex-col items-center gap-4"
          />
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl border border-teal/20 bg-teal/[0.04]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
            <Search className="h-7 w-7 text-teal" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-lg">
            {searchQuery
              ? "Врачи не найдены по вашему запросу"
              : selectedDate
                ? "Нет врачей, доступных на выбранную дату"
                : "В данной категории пока нет врачей"}
          </p>
          {(searchQuery || selectedDate) && (
            <Button
              variant="outline"
              className="mt-4 rounded-full border-teal/40 text-teal hover:bg-teal/10 hover:text-teal transition-all"
              onClick={() => {
                setSearchQuery("");
                handleDateChange(null);
              }}
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
