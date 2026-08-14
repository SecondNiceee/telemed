import { CategoriesGrid } from "@/components/categories-grid";
import type { ApiCategory } from "@/lib/api/types";

const ICONS = [
  "heart", "brain", "eye", "ear", "bone", "baby", "smile", "activity",
  "thermometer", "shield", "syringe", "pill", "microscope", "dna",
  "wind", "bed", "scissors", "bandage", "radiation", "user-round",
  "stethoscope", "heart-pulse", "hand-heart",
];

const categories: ApiCategory[] = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `Специальность ${i + 1}`,
  slug: `spec-${i + 1}`,
  description: "Краткое описание специальности врача для проверки вёрстки карточки.",
  icon: ICONS[i % ICONS.length],
  iconImage: null,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
})) as unknown as ApiCategory[];

export default function PaginationTestPage() {
  return (
    <section className="py-10 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Pagination test</h1>
        <CategoriesGrid categories={categories} />
      </div>
    </section>
  );
}
