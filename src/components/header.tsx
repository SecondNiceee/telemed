"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { LoginModal } from "@/components/login-modal";
import { useRouter } from "next/navigation";
import { AuthApi } from "@/lib/api/auth";
import { resolveImageUrl } from "@/lib/utils/image";
import { toast } from "sonner";
import type { User } from "@/payload-types";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  // Fetch user on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await AuthApi.me();
        setUser(userData);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  /** При клике на «Войти» / «Записаться»: проверяем сессию, если есть — редирект на /lk, иначе — открываем модалку */
  const handleAuthClick = async () => {
    if (user) {
      router.push("/lk");
    } else {
      setLoginModalOpen(true);
    }
  };

  const handleLogout = async () => {
    try {
      await AuthApi.logout();
      setUser(null);
      toast.success("Вы успешно вышли из аккаунта");
      router.push("/");
    } catch {
      toast.error("Ошибка при выходе");
    }
  };

  const handleLoginSuccess = () => {
    // Refetch user after login
    AuthApi.me().then(setUser).catch(() => setUser(null));
  };

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[62px]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden ring-1 ring-border/60 shadow-sm shadow-primary/10">
              <img
                src={resolveImageUrl(`/images/logo.jpg`)}
                alt="Smartcardio"
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col leading-none gap-[4px]">
              <span className="text-[19px] font-bold tracking-[-0.03em] text-foreground">
                Smartcardio
              </span>
              <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary/70">
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

          <div className="hidden md:flex items-center gap-4 min-h-[36px]">
            {loading ? (
              <div className="h-9 w-[164px] rounded-md bg-muted animate-pulse" />
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
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти</span>
                </button>
              </>
            ) : (
              <>
                <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} onSuccess={handleLoginSuccess}>
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
              <div className="flex flex-col gap-2 pt-4 border-t border-border min-h-[52px]">
                {loading ? (
                  <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
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
                        handleLogout();
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors py-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Выйти</span>
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} onSuccess={handleLoginSuccess}>
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
