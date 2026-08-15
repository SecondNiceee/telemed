"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { LoginModal } from "@/components/login-modal";
import { useUserStore } from "@/stores/user-store";
import { useUserAppointmentStore } from "@/stores/user-appointments-store";
import { useRouter, usePathname } from "next/navigation";
import { AuthApi } from "@/lib/api/auth";
import { getUpcomingAppointment } from "@/lib/utils/date";
import { AppointmentCountdownBanner } from "@/components/appointment-countdown-banner";
import { SECTIONS, sectionHref } from "@/lib/constants/nav-sections";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");
  const headerRef = useRef<HTMLElement>(null);

  const router = useRouter();
  const pathname = usePathname();

  const { user, loading: userLoading, fetched: userFetched, logout: logoutUser } = useUserStore();
  const { appointments, fetched: apptFetched, fetchAppointments } = useUserAppointmentStore();

  // Fetch appointments when user is logged in and appointments haven't been fetched yet
  useEffect(() => {
    if (user && !apptFetched) {
      fetchAppointments();
    }
  }, [user, apptFetched, fetchAppointments]);

  const upcomingAppointment =
    user && apptFetched ? getUpcomingAppointment(appointments) : null;

  // Show banner only on homepage (/) for logged-in users with upcoming appointments
  const showBanner = !!upcomingAppointment && pathname === "/";

  /** Имя пользователя, либо его email */
  const userLabel = user ? user.name || user.email : "";

  /** При клике на «Войти» / «Записаться»: проверяем сессию, если есть — редирект на /lk, иначе — открываем модалку */
  const handleAuthClick = async () => {
    setMobileMenuOpen(false);
    try {
      const user = await AuthApi.me();
      if (!user) setLoginModalOpen(true);
      else{
        router.push("/lk");
      }
    } catch {
      setLoginModalOpen(true);
    }
  };

  const authLoading = userLoading || !userFetched;

  const isHome = pathname === "/";

  /** Плавный скролл к секции с учётом высоты залипающего хэдера */
  const scrollToSection = useCallback(
    (id: string) => {
      const target = document.getElementById(id);
      if (!target) return;
      const headerHeight = headerRef.current?.offsetHeight ?? 68;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
      setActiveSection(id);
    },
    [],
  );

  /** Клик по ссылке в навигации: на главной — скролл, иначе — переход на /#id */
  const handleNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    setMobileMenuOpen(false);
    if (!isHome) return;
    event.preventDefault();
    scrollToSection(id);
    window.history.replaceState(null, "", id === "hero" ? "/" : `/#${id}`);
  };

  /** Если на главную пришли по ссылке с хэшем — доскроллим с учётом хэдера */
  useEffect(() => {
    if (!isHome) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => scrollToSection(hash), 250);
    return () => window.clearTimeout(timer);
  }, [isHome, scrollToSection]);

  /** Подсветка активной секции при скролле */
  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => {
      const headerHeight = (headerRef.current?.offsetHeight ?? 68) + 24;
      let current = SECTIONS[0].id as string;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= headerHeight) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[68px]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden ring-1 ring-border/60 shadow-sm shadow-primary/10">
              <img
                src="/images/logo.jpg"
                alt="Smartcardio"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none gap-[4px]">
              <span className="text-[19px] font-bold tracking-[-0.03em] text-foreground">
                Smartcardio
              </span>
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-teal">
                Видеоконсультация с врачом
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 lg:gap-7">
            {SECTIONS.map((section) => {
              const isActive = isHome && activeSection === section.id;
              return (
                <Link
                  key={section.id}
                  href={sectionHref(section.id)}
                  onClick={(event) => handleNavClick(event, section.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`relative text-[15px] transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {section.label}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-1.5 left-0 h-[2px] rounded-full bg-primary transition-all duration-300 ${
                      isActive ? "w-full opacity-100" : "w-0 opacity-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-4 min-h-[36px]">
            {authLoading ? (
              <div className="h-9 w-[164px] rounded-md bg-muted animate-pulse" />
            ) : user ? (
              <>
                <Link
                  href="/lk"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors font-medium"
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[180px] truncate">{userLabel}</span>
                </Link>
                <button
                  onClick={logoutUser}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти</span>
                </button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={handleAuthClick}>
                  Войти
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-primary px-5 text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all duration-200"
                  onClick={handleAuthClick}
                >
                  Записаться
                </Button>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              {SECTIONS.map((section) => (
                <Link
                  key={section.id}
                  href={sectionHref(section.id)}
                  onClick={(event) => handleNavClick(event, section.id)}
                  className={`transition-colors ${
                    isHome && activeSection === section.id
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {section.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-border min-h-[52px]">
                {authLoading ? (
                  <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
                ) : user ? (
                  <>
                    <Link
                      href="/lk"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors font-medium py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="truncate">{userLabel}</span>
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logoutUser();
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors py-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Выйти</span>
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={handleAuthClick}>
                      Войти
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                      onClick={handleAuthClick}
                    >
                      Записаться
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Единственный экземпляр модалки на весь хэдер.
          Раньше она рендерилась дважды (десктоп + мобильное меню) с одним и тем же
          controlled-состоянием: при открытом мобильном меню монтировались два
          диалога с дублирующимися id полей и конкурирующими focus-trap. */}
      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />

      {/* Upcoming appointment banner — shown only on homepage for users with appointments */}
      {showBanner && (
        <div className="border-t border-border/60 bg-card/50 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto">
            <AppointmentCountdownBanner
              appointment={upcomingAppointment}
              variant="header"
            />
          </div>
        </div>
      )}
    </header>
  );
}
