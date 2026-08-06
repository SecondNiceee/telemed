"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  X
} from "lucide-react";
import type { ApiCategory } from "@/lib/api/types";
import { CategoryIcon } from "@/lib/utils/categoryIcon";
import { cn } from "@/lib/utils";

interface AppointmentPageClientProps {
  initialCategories: ApiCategory[];
}

export function AppointmentPageClient({ initialCategories }: AppointmentPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.getFullYear(), today.getMonth(), diff);
  });

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return initialCategories;
    
    const query = searchQuery.toLowerCase();
    return initialCategories.filter(
      (category) =>
        category.name.toLowerCase().includes(query) ||
        (category.description && category.description.toLowerCase().includes(query))
    );
  }, [initialCategories, searchQuery]);

  // Generate week days
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  const formatDayName = (date: Date) =>
    date.toLocaleDateString("ru-RU", { weekday: "short" });

  const formatDayNumber = (date: Date) => date.getDate();

  const formatMonthYear = () => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return firstDay.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    }
    return `${firstDay.toLocaleDateString("ru-RU", { month: "short" })} - ${lastDay.toLocaleDateString("ru-RU", { month: "short", year: "numeric" })}`;
  };

  const toDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const isDateInPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const handleDateSelect = (date: Date) => {
    if (!isDateInPast(date)) {
      const dateStr = toDateStr(date);
      setSelectedDate(selectedDate === dateStr ? null : dateStr);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const toggleDateFilter = () => {
    setIsDateFilterOpen(!isDateFilterOpen);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            На главную
          </Link>
        </Button>

        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
          Записаться на приём
        </h1>
        <p className="text-muted-foreground text-lg">
          Выберите специальность врача и удобное время
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск по категориям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Date Filter - Collapsible */}
      <div className="mb-6">
        {/* Toggle Button */}
        <button
          onClick={toggleDateFilter}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
            isDateFilterOpen || selectedDate
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              selectedDate ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
            )}>
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                {selectedDate ? "Фильтр по дате" : "Фильтр по дате"}
              </p>
              {selectedDate ? (
                <p className="text-xs text-primary">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Выберите дату для поиска доступных врачей
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearDateFilter();
                }}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform duration-200",
              isDateFilterOpen && "rotate-180"
            )} />
          </div>
        </button>

        {/* Collapsible Content */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isDateFilterOpen ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"
        )}>
          <Card className="border-border/60">
            <CardContent className="p-4 sm:p-6">
              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h3 className="text-sm font-medium text-muted-foreground capitalize">
                  {formatMonthYear()}
                </h3>
                <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Days Row */}
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((date) => {
                  const dateStr = toDateStr(date);
                  const isPast = isDateInPast(date);
                  const isSelected = selectedDate === dateStr;
                  const isToday = toDateStr(new Date()) === dateStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateSelect(date)}
                      disabled={isPast}
                      className={`
                        flex flex-col items-center p-2 sm:p-3 rounded-xl transition-all
                        ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : isPast
                              ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                              : isToday
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : "bg-secondary hover:bg-primary/10 text-foreground"
                        }
                      `}
                    >
                      <span className="text-xs uppercase mb-1">
                        {formatDayName(date)}
                      </span>
                      <span className="text-base sm:text-lg font-semibold">
                        {formatDayNumber(date)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <p className="mt-4 text-sm text-center text-muted-foreground">
                  Показаны категории с врачами, доступными на{" "}
                  <span className="font-medium text-foreground">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Специальности ({filteredCategories.length})
        </h2>

        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => (
            <Link
              key={category.id}
              href={
                selectedDate
                  ? `/category/${category.slug}?date=${selectedDate}`
                  : `/category/${category.slug}`
              }
            >
              <Card className="group py-0 border-border/60 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:border-primary/40 cursor-pointer hover:-translate-y-0.5">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-300 shadow-sm">
                      <CategoryIcon category={category} className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery
                ? "Категории не найдены по вашему запросу"
                : "Категории пока не добавлены"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
