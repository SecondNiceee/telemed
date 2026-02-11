"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.jpg"
              alt="smartcardio"
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-contain"
            />
            <span className="text-xl font-semibold text-foreground">
              smartcardio Телемедицина
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
            <Button variant="ghost" size="sm">
              Войти
            </Button>
            <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5 transition-all">Записаться</Button>
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
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" className="flex-1">
                  Войти
                </Button>
                <Button variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary/5 transition-all">
                  Записаться
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
