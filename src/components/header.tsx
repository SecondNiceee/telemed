"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { LoginModal } from "@/components/login-modal";
import { useUserStore } from "@/stores/user-store";
import { useOrgStore } from "@/stores/org-store";
import { useDoctorStore } from "@/stores/doctor-store";
import { resolveImageUrl } from "@/lib/utils/image";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user, loading: userLoading, fetched: userFetched, fetchUser, refetchUser, logout: logoutUser } = useUserStore();
  const { org, loading: orgLoading, fetched: orgFetched, fetchOrg, logout: logoutOrg } = useOrgStore();
  const { doctor, loading: doctorLoading, fetched: doctorFetched, fetchDoctor, logout: logoutDoctor } = useDoctorStore();

  const allFetched = userFetched && orgFetched && doctorFetched;
  const anyLoading = userLoading || orgLoading || doctorLoading;
  const authLoading = anyLoading || !allFetched;

  useEffect(() => {
    fetchUser();
    fetchOrg();
    fetchDoctor();
  }, [fetchUser, fetchOrg, fetchDoctor]);

  // Determine which entity is logged in (priority: org > doctor > user)
  const activeEntity = org
    ? { label: org.name || org.email, href: "/lk-org", handleLogout: logoutOrg }
    : doctor
      ? { label: doctor.name || doctor.email, href: "/lk-med", handleLogout: logoutDoctor }
      : user
        ? { label: user.name || user.email, href: "/lk", handleLogout: logoutUser }
        : null;

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={`${resolveImageUrl("/images/logo.jpg")}`}
              alt="smartcardio"
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-contain"
            />
            <span className="text-xl font-semibold text-foreground">
              SmartcardioТелемедицина
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Главная
            </Link>
            <Link
              href="/#categories"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Специалисты
            </Link>
            <Link
              href="/#how-it-works"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Как это работает
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {authLoading ? (
              <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
            ) : activeEntity ? (
              <>
                <Link
                  href={activeEntity.href}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors font-medium"
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[180px] truncate">{activeEntity.label}</span>
                </Link>
                <button
                  onClick={activeEntity.handleLogout}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти</span>
                </button>
              </>
            ) : (
              <>
                <LoginModal onSuccess={refetchUser}>
                  <Button variant="ghost" size="sm">
                    Войти
                  </Button>
                </LoginModal>
                <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5 transition-all">Записаться</Button>
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
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Главная
              </Link>
              <Link
                href="/#categories"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Специалисты
              </Link>
              <Link
                href="/#how-it-works"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Как это работает
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                {authLoading ? (
                  <div className="h-9 rounded-md bg-muted animate-pulse" />
                ) : activeEntity ? (
                  <>
                    <Link
                      href={activeEntity.href}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors font-medium py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="truncate">{activeEntity.label}</span>
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        activeEntity.handleLogout();
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors py-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Выйти</span>
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <LoginModal onSuccess={refetchUser}>
                      <Button variant="ghost" size="sm" className="flex-1">
                        Войти
                      </Button>
                    </LoginModal>
                    <Button variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary/5 transition-all">
                      Записаться
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
