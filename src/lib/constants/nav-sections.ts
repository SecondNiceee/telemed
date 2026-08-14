/**
 * Секции главной страницы.
 * Единый источник правды для навигации в хэдере и футере,
 * чтобы ссылки не расходились между собой.
 */
export const SECTIONS = [
  { id: "hero", label: "Главная" },
  { id: "categories", label: "Специалисты" },
  { id: "advantages", label: "Преимущества" },
  { id: "reviews", label: "Отзывы" },
  { id: "faq", label: "Вопросы" },
] as const;

export type NavSectionId = (typeof SECTIONS)[number]["id"];

/** Ссылка на секцию: «Главная» ведёт на корень, остальные — на /#id */
export function sectionHref(id: string) {
  return id === "hero" ? "/" : `/#${id}`;
}
