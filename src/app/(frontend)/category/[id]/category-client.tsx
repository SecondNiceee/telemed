"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DoctorCard } from "@/components/doctor-card";
import { Search, X, Calendar } from "lucide-react";
import type { ApiDoctor } from "@/lib/api/types";

interface CategoryPageClientProps {
  doctors: ApiDoctor[];
  categorySlug: string;
  initialSelectedDate?: string;
}

export function CategoryPageClient({ 
  doctors, 
  categorySlug,
  initialSelectedDate 
}: CategoryPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter doctors by search query and selected date
  const filteredDoctors = useMemo(() => {
    let result = doctors;

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
    if (initialSelectedDate) {
      result = result.filter((doctor) => {
        if (!doctor.schedule || !Array.isArray(doctor.schedule)) return false;
        
        return doctor.schedule.some((dayEntry) => {
          if (typeof dayEntry === 'object' && dayEntry !== null && 'date' in dayEntry) {
            const scheduleDay = dayEntry as { date: string; slots?: unknown[] };
            return (
              scheduleDay.date === initialSelectedDate &&
              scheduleDay.slots &&
              scheduleDay.slots.length > 0
            );
          }
          return false;
        });
      });
    }

    return result;
  }, [doctors, searchQuery, initialSelectedDate]);

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

        {/* Date filter indicator */}
        {initialSelectedDate && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-teal/10 border border-teal/25">
            <Calendar className="w-4 h-4 text-teal" />
            <span className="text-sm text-foreground">
              Показаны врачи, доступные на{" "}
              <span className="font-medium">
                {new Date(initialSelectedDate + "T00:00:00").toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="ml-auto rounded-full text-teal hover:bg-teal/15 hover:text-teal"
            >
              <Link href={`/category/${categorySlug}`}>
                <X className="w-4 h-4 mr-1" />
                Сбросить
              </Link>
            </Button>
          </div>
        )}

        {/* Count */}
        <p className="text-sm text-muted-foreground">
          Найдено врачей:{" "}
          <span className="inline-flex items-center rounded-full bg-teal/10 px-2.5 py-0.5 font-semibold text-teal">
            {filteredDoctors.length}
          </span>
          {searchQuery && ` по запросу "${searchQuery}"`}
        </p>
      </div>

      {/* Doctors list */}
      {filteredDoctors.length > 0 ? (
        <div className="grid gap-3">
          {filteredDoctors.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl border border-teal/20 bg-teal/[0.04]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
            <Search className="h-7 w-7 text-teal" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-lg">
            {searchQuery
              ? "Врачи не найдены по вашему запросу"
              : initialSelectedDate
                ? "Нет врачей, доступных на выбранную дату"
                : "В данной категории пока нет врачей"}
          </p>
          {(searchQuery || initialSelectedDate) && (
            <Button 
              variant="outline" 
              className="mt-4 rounded-full border-teal/40 text-teal hover:bg-teal/10 hover:text-teal transition-all"
              onClick={() => {
                setSearchQuery("");
              }}
              asChild={!!initialSelectedDate}
            >
              {initialSelectedDate ? (
                <Link href={`/category/${categorySlug}`}>Сбросить фильтры</Link>
              ) : (
                "Сбросить поиск"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
