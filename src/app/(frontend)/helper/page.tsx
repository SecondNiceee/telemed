import Link from "next/link";
import { USERS, DOCTORS, CATEGORIES, DEFAULT_ORGANISATION } from "../../../../scripts/seed-data.config";
import { CredentialsTable } from "./credentials-table";

export const metadata = {
  title: "Helper — тестовые учётные данные",
  description: "Список всех тестовых аккаунтов из seed-скриптов",
};

const ADMIN = {
  email: "col1596321@gmail.com",
  password: "11559966332211kkKK",
};

export default function HelperPage() {
  const categoryByslug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.name]));

  return (
    <main className="min-h-screen bg-background py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Helper — тестовые учётные данные
          </h1>
          <p className="text-muted-foreground text-pretty">
            Все аккаунты, которые создаются seed-скриптами (
            <code className="px-1.5 py-0.5 rounded bg-muted text-sm">pnpm tsx scripts/seed-all.ts</code>
            ). Используйте для быстрого входа в разные роли.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-primary rounded-full" aria-hidden />
            Администратор
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Доступ в админ-панель Payload CMS:{" "}
            <Link href="/admin" className="text-primary underline-offset-2 hover:underline">
              /admin
            </Link>
          </p>
          <CredentialsTable
            columns={["Email", "Пароль"]}
            rows={[[ADMIN.email, ADMIN.password]]}
          />
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-primary rounded-full" aria-hidden />
            Организация
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Личный кабинет:{" "}
            <Link href="/lk-org" className="text-primary underline-offset-2 hover:underline">
              /lk-org
            </Link>
          </p>
          <CredentialsTable
            columns={["Название", "Email", "Пароль"]}
            rows={[[DEFAULT_ORGANISATION.name, DEFAULT_ORGANISATION.email, DEFAULT_ORGANISATION.password]]}
          />
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-primary rounded-full" aria-hidden />
            Врачи
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Личный кабинет:{" "}
            <Link href="/lk-med" className="text-primary underline-offset-2 hover:underline">
              /lk-med
            </Link>
            . Пароль для всех врачей:{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-sm">Doctor123!</code>
          </p>
          <CredentialsTable
            columns={["ФИО", "Категория", "Email", "Пароль", "Цена", "Стаж"]}
            rows={DOCTORS.map((d) => [
              d.name,
              categoryByslug[d.categorySlug] ?? d.categorySlug,
              d.email,
              d.password,
              `${d.price} ₽`,
              `${d.experience} лет`,
            ])}
          />
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-primary rounded-full" aria-hidden />
            Пользователи (пациенты)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Личный кабинет:{" "}
            <Link href="/lk" className="text-primary underline-offset-2 hover:underline">
              /lk
            </Link>
            . Пароль для всех пользователей:{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-sm">User123!</code>
          </p>
          <CredentialsTable
            columns={["Имя", "Email", "Пароль"]}
            rows={USERS.map((u) => [u.name, u.email, u.password])}
          />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-primary rounded-full" aria-hidden />
            Категории врачей
          </h2>
          <CredentialsTable
            columns={["Название", "Slug", "Описание"]}
            rows={CATEGORIES.map((c) => [c.name, c.slug, c.description])}
          />
        </section>
      </div>
    </main>
  );
}
