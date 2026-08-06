import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { fetchCategoriesLocal } from "@/lib/api/categories.server";
import { AppointmentPageClient } from "./appointment-client";

export const metadata = {
  title: "Записаться на приём - smartcardio",
  description: "Выберите специалиста и запишитесь на удобное время",
};

export const revalidate = 60;

export default async function AppointmentPage() {
  const categories = await fetchCategoriesLocal();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-primary/5 via-background to-background">
        <AppointmentPageClient initialCategories={categories} />
      </main>
      <Footer />
    </div>
  );
}
