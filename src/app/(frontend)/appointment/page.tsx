import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { fetchCategoriesLocal } from "@/lib/api/categories.server";
import { AppointmentPageClient } from "./appointment-client";
import { BackgroundDecor } from "@/components/background-decor";

export const metadata = {
  title: "Записаться на приём - smartcardio",
  description: "Выберите специалиста и запишитесь на удобное время",
};

export const revalidate = 60;

export default async function AppointmentPage() {
  const categories = await fetchCategoriesLocal();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Сквозной декор (сетка + водяные знаки логотипа), как на главной.
          ecg={false} — под плотным списком специальностей линии мешают читать. */}
      <BackgroundDecor id="appointment" position="fixed" ecg={false} />
      <Header />
      {/* Градиент прозрачный (teal/…), иначе непрозрачный to-background
          перекрыл бы фиксированный декор под ним. */}
      <main className="relative z-10 flex-1 bg-gradient-to-b from-teal/[0.07] via-transparent to-transparent">
        <AppointmentPageClient initialCategories={categories} />
      </main>
      <Footer />
    </div>
  );
}
