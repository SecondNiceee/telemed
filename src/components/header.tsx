"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { LoginModal } from "@/components/login-modal";
import { useUserStore } from "@/stores/user-store";
import { useRouter } from "next/navigation";
import { AuthApi } from "@/lib/api/auth";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const router = useRouter();

  const { user, loading: userLoading, fetched: userFetched, logout: logoutUser } = useUserStore();

  /** При клике на «Войти» / «Записаться»: проверяем сессию, если есть — редирект на /lk, иначе — открываем модалку */
  const handleAuthClick = async () => {
    try {
      const user = await AuthApi.me();
      console.log(user);
      if (!user) setLoginModalOpen(true);
      else{
        router.push("/lk");
      }
    } catch {
      setLoginModalOpen(true);
    }
  };

  const authLoading = userLoading || !userFetched;

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[62px]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary shadow-sm shadow-primary/30 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 3a7 7 0 1 0 0 14A7 7 0 0 0 10 3Z" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M7 10h2l1.5-3L12 13l1-3h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight text-foreground">
                Smartcardio
              </span>
              <span className="text-[9px] font-medium tracking-[0.18em] uppercase text-muted-foreground mt-0.5">
                Телемедицина
              </span>
            </div>
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
            ) : user ? (
              <>
                <Link
                  href="/lk"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors font-medium"
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[180px] truncate">{user.name || user.email}</span>
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
                <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen}>
                  <Button variant="ghost" size="sm" onClick={handleAuthClick}>
                    Войти
                  </Button>
                </LoginModal>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary/5 transition-all"
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
                ) : user ? (
                  <>
                    <Link
                      href="/lk"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors font-medium py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="truncate">{user.name || user.email}</span>
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
                    <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen}>
                      <Button variant="ghost" size="sm" className="flex-1" onClick={handleAuthClick}>
                        Войти
                      </Button>
                    </LoginModal>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-primary text-primary hover:bg-primary/5 transition-all"
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
    </header>
  );
}
