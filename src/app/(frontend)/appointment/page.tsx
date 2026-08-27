import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { fetchCategoriesWithDoctorsLocal } from "@/lib/api/categories.server";
import { AppointmentPageClient } from "./appointment-client";
import { BackgroundDecor } from "@/components/background-decor";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Записаться на приём",
  description:
    "Выберите специалиста и запишитесь на видеоконсультацию на удобное время.",
  path: "/appointment",
  keywords: ["записаться к врачу онлайн", "запись на видеоконсультацию", "выбрать специалиста"],
});

export const revalidate = 60;

export default async function AppointmentPage() {
  const categories = await fetchCategoriesWithDoctorsLocal();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Сквозной декор (сетка + водяные знаки логотипа), как на главной.
          ecg={false} — под плотным списком специальностей линии мешают читать. */}
      <BackgroundDecor id="appointment" position="fixed" ecg={false} />
      <Header />
      {/* Фон полностью прозрачный — сквозь него виден фиксированный BackgroundDecor. */}
      <main className="relative z-10 flex-1 bg-transparent">
        <AppointmentPageClient initialCategories={categories} />
      </main>
      <Footer />
    </div>
  );
}
