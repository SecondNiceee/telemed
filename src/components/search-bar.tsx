"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Stethoscope, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "doctor" | "symptom" | "category";
  name: string;
  description?: string;
  slug?: string;
}

// Симптомы с маппингом на категории
const SYMPTOMS_DATA = [
  { symptom: "Боль в сердце", category: "cardiologist", categoryName: "Кардиолог" },
  { symptom: "Аритмия", category: "cardiologist", categoryName: "Кардиолог" },
  { symptom: "Высокое давление", category: "cardiologist", categoryName: "Кардиолог" },
  { symptom: "Одышка", category: "cardiologist", categoryName: "Кардиолог" },
  { symptom: "Учащенное сердцебиение", category: "cardiologist", categoryName: "Кардиолог" },
  { symptom: "Боль в груди", category: "cardiologist", categoryName: "Кардиолог" },
  { symptom: "Головная боль", category: "therapist", categoryName: "Терапевт" },
  { symptom: "Температура", category: "therapist", categoryName: "Терапевт" },
  { symptom: "Слабость", category: "therapist", categoryName: "Терапевт" },
  { symptom: "Простуда", category: "therapist", categoryName: "Терапевт" },
  { symptom: "Кашель", category: "therapist", categoryName: "Терапевт" },
  { symptom: "Усталость", category: "therapist", categoryName: "Терапевт" },
];

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  // Search logic
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchLower = query.toLowerCase();

    // Search in symptoms
    const symptomResults: SearchResult[] = SYMPTOMS_DATA
      .filter(s => s.symptom.toLowerCase().includes(searchLower))
      .map(s => ({
        id: `symptom-${s.symptom}`,
        type: "symptom" as const,
        name: s.symptom,
        description: `Рекомендуем: ${s.categoryName}`,
        slug: s.category,
      }));

    // Mock category results based on common specialties
    const categories = [
      { name: "Кардиолог", slug: "cardiologist", desc: "Болезни сердца и сосудов" },
      { name: "Терапевт", slug: "therapist", desc: "Общая медицина" },
      { name: "Невролог", slug: "neurologist", desc: "Нервная система" },
      { name: "Эндокринолог", slug: "endocrinologist", desc: "Гормоны и обмен веществ" },
    ];

    const categoryResults: SearchResult[] = categories
      .filter(c => c.name.toLowerCase().includes(searchLower) || c.desc.toLowerCase().includes(searchLower))
      .map(c => ({
        id: `cat-${c.slug}`,
        type: "category" as const,
        name: c.name,
        description: c.desc,
        slug: c.slug,
      }));

    setResults([...categoryResults, ...symptomResults].slice(0, 6));
    setLoading(false);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    if (result.slug) {
      router.push(`/category/${result.slug}`);
    }
    setQuery("");
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
          className="pl-14 pr-12 py-7 text-base rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
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
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-card/95 backdrop-blur-lg border border-border/60 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden z-50">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Поиск...
            </div>
          ) : results.length > 0 ? (
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
                        ? "bg-primary/10 text-primary" 
                        : "bg-secondary text-foreground"
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
                        ? "bg-primary/10 text-primary" 
                        : "bg-secondary text-muted-foreground"
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
