"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Stethoscope, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ApiCategory } from "@/lib/api/types";

interface SearchResult {
  id: string;
  type: "symptom" | "category";
  name: string;
  description?: string;
  slug: string;
}

// Симптомы с маппингом на слаг категории, которую стоит порекомендовать
const SYMPTOMS_DATA = [
  { symptom: "Боль в сердце", category: "cardiologist" },
  { symptom: "Аритмия", category: "cardiologist" },
  { symptom: "Высокое давление", category: "cardiologist" },
  { symptom: "Одышка", category: "cardiologist" },
  { symptom: "Учащенное сердцебиение", category: "cardiologist" },
  { symptom: "Боль в груди", category: "cardiologist" },
  { symptom: "Головная боль", category: "therapist" },
  { symptom: "Температура", category: "therapist" },
  { symptom: "Слабость", category: "therapist" },
  { symptom: "Простуда", category: "therapist" },
  { symptom: "Кашель", category: "therapist" },
  { symptom: "Усталость", category: "therapist" },
];

const MAX_RESULTS = 8;

/**
 * Приводим строку к виду, удобному для сравнения:
 * нижний регистр, «ё» → «е», схлопнутые пробелы.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** Совпадение в начале строки или в начале любого слова — самое релевантное */
function matchRank(haystack: string, needle: string): number {
  if (haystack.startsWith(needle)) return 0;
  if (haystack.split(" ").some((word) => word.startsWith(needle))) return 1;
  if (haystack.includes(needle)) return 2;
  return -1;
}

export function SearchBar({ categories = [] }: { categories?: ApiCategory[] }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const search = normalize(query);
    if (search.length < 2) return [];

    // Ищем по реальным категориям из Payload — по названию и описанию
    const categoryResults = categories
      .map((category) => {
        const byName = matchRank(normalize(category.name), search);
        const byDescription = category.description
          ? matchRank(normalize(category.description), search)
          : -1;
        // Совпадение в названии всегда важнее совпадения в описании
        const rank =
          byName !== -1 ? byName : byDescription !== -1 ? byDescription + 3 : -1;

        return { category, rank };
      })
      .filter(({ rank }) => rank !== -1)
      .sort((a, b) => a.rank - b.rank || a.category.name.localeCompare(b.category.name))
      .map<SearchResult>(({ category }) => ({
        id: `cat-${category.slug}`,
        type: "category",
        name: category.name,
        description: category.description ?? undefined,
        slug: category.slug,
      }));

    // Симптом показываем только если рекомендуемая категория реально существует
    const symptomResults = SYMPTOMS_DATA.map((item) => ({
      item,
      target: categories.find((category) => category.slug === item.category),
      rank: matchRank(normalize(item.symptom), search),
    }))
      .filter(({ rank, target }) => rank !== -1 && Boolean(target))
      .sort((a, b) => a.rank - b.rank)
      .map<SearchResult>(({ item, target }) => ({
        id: `symptom-${item.symptom}`,
        type: "symptom",
        name: item.symptom,
        description: `Рекомендуем: ${target!.name}`,
        slug: target!.slug,
      }));

    return [...categoryResults, ...symptomResults].slice(0, MAX_RESULTS);
  }, [query, categories]);

  const handleSelect = (result: SearchResult) => {
    router.push(`/category/${result.slug}`);
    setQuery("");
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-teal" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Поиск по симптомам или специальности..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-14 pr-12 py-7 text-base rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-lg shadow-teal/5 focus:border-teal/60 focus:ring-2 focus:ring-teal/25 transition-all"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Очистить поиск"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && normalize(query).length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-card/95 backdrop-blur-lg border border-border/60 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden z-50">
          {results.length > 0 ? (
            <ul className="py-2">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    onClick={() => handleSelect(result)}
                    className={cn(
                      "w-full px-4 py-3 flex items-start gap-3 hover:bg-accent/50 transition-colors text-left"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      result.type === "symptom" 
                        ? "bg-teal-soft text-teal" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {result.type === "symptom" ? (
                        <Activity className="w-5 h-5" />
                      ) : (
                        <Stethoscope className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{result.name}</p>
                      {result.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {result.description}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full shrink-0",
                      result.type === "symptom" 
                        ? "bg-teal-soft text-teal" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {result.type === "symptom" ? "Симптом" : "Специальность"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Ничего не найдено
            </div>
          )}
        </div>
      )}
    </div>
  );
}
