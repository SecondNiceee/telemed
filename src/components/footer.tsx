import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { resolveImageUrl } from "@/lib/image";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <img
                src={`${resolveImageUrl("/images/logo.jpg")}`}
                alt="smartcardio"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-xl font-semibold">smartcardio</span>
            </Link>
            <p className="text-background/70 text-sm leading-relaxed">
              Современная платформа телемедицины для онлайн консультаций с врачами.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Услуги</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li>
                <Link href="/#categories" className="hover:text-background transition-colors">
                  Консультации врачей
                </Link>
              </li>
              <li>
                <Link href="/#categories" className="hover:text-background transition-colors">
                  Расшифровка анализов
                </Link>
              </li>
              <li>
                <Link href="/#categories" className="hover:text-background transition-colors">
                  Второе мнение
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Компания</h4>
            <ul className="space-y-2 text-background/70 text-sm">
              <li>
                <Link href="/" className="hover:text-background transition-colors">
                  О нас
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-background transition-colors">
                  Врачам
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-background transition-colors">
                  Контакты
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Контакты</h4>
            <ul className="space-y-3 text-background/70 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>8 (800) 123-45-67</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>info@medonline.ru</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Москва, Россия</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/20 text-center text-background/50 text-sm">
          <p>&copy; {new Date().getFullYear()} smartcardio. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
