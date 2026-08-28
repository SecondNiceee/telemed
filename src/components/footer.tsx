import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { FooterNav } from "@/components/footer-nav";

export function Footer() {
  return (
    <footer className="relative z-10 bg-surface-dark text-white py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/images/logo.jpg"
                alt="smartcardio"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-xl font-semibold">smartcardio</span>
            </Link>
            <p className="text-white/70 text-sm leading-relaxed">
              Техническая платформа для видеоконсультаций. Медицинские услуги оказывают
              медицинские организации по собственным лицензиям.
            </p>
          </div>

          <div>
            {/*
              «Возможности платформы», а не «Услуги»: список под этим заголовком -
              то, что можно сделать через платформу, а сами медицинские услуги
              оказывают клиники по своим лицензиям. Заголовок «Услуги» на сайте
              платформы читается как «услуги оказываем мы» и опровергает
              разделение ответственности, на котором держится модель поручения.
            */}
            <h4 className="font-semibold mb-4">Возможности платформы</h4>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>
                <Link href="/#categories" className="hover:text-teal-on-dark transition-colors">
                  Консультации врачей
                </Link>
              </li>
              <li>
                <Link href="/#categories" className="hover:text-teal-on-dark transition-colors">
                  Расшифровка анализов
                </Link>
              </li>
              <li>
                <Link href="/#categories" className="hover:text-teal-on-dark transition-colors">
                  Второе мнение
                </Link>
              </li>
            </ul>
          </div>

          <FooterNav />

          <div>
            <h4 className="font-semibold mb-4">Контакты</h4>
            <ul className="space-y-3 text-white/70 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-on-dark" />
                <span>8 (800) 123-45-67</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-on-dark" />
                <span>info@smartcardio.ru</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-on-dark" />
                <span>Москва, Россия</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/15 flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href="/legal/privacy"
            className="text-white/70 text-sm hover:text-teal-on-dark transition-colors"
          >
            Политика обработки персональных данных
          </Link>
          <Link
            href="/legal/consent"
            className="text-white/70 text-sm hover:text-teal-on-dark transition-colors"
          >
            Согласие на обработку персональных данных
          </Link>
          <Link
            href="/legal/offer"
            className="text-white/70 text-sm hover:text-teal-on-dark transition-colors"
          >
            Публичная оферта
          </Link>
          <Link
            href="/legal/clinics"
            className="text-white/70 text-sm hover:text-teal-on-dark transition-colors"
          >
            Медицинские организации и лицензии
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-white/15">
          <p className="text-white/55 text-xs leading-relaxed max-w-3xl text-pretty">
            Сервис оказывает информационно-консультационные услуги. Консультации не являются
            медицинской помощью. Сервис не ставит диагнозы, не назначает лечение, не выписывает
            рецепты. При необходимости обратитесь в медицинское учреждение.
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/lk-org"
            className="px-4 py-2 text-sm font-medium rounded-md border border-white/25 hover:bg-white/10 transition-colors"
          >
            Для организации
          </Link>
          <Link
            href="/lk-med"
            className="px-4 py-2 text-sm font-medium rounded-md border border-white/25 hover:bg-white/10 transition-colors"
          >
            Для врачей
          </Link>
        </div>
      </div>
    </footer>
  );
}
