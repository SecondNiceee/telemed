"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, sectionHref } from "@/lib/constants/nav-sections";

/**
 * Навигация по секциям главной страницы в футере.
 * Полностью повторяет ссылки хэдера и использует тот же плавный скролл,
 * когда пользователь уже находится на главной.
 */
export function FooterNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  /** На главной — плавный скролл к секции, иначе — обычный переход по ссылке */
  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    if (!isHome) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const header = document.querySelector("header");
    const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 68;
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    window.history.replaceState(null, "", sectionHref(id));
  };

  return (
    <nav aria-label="Навигация по разделам">
      <h4 className="font-semibold mb-4">Разделы</h4>
      <ul className="space-y-2 text-white/70 text-sm">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={sectionHref(section.id)}
              onClick={(event) => handleClick(event, section.id)}
              className="hover:text-teal-on-dark transition-colors"
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
