import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { BRAND_COLOR, SITE_NAME, SITE_URL } from '@/lib/seo'
import { AppInit } from '@/components/app-init'
import { NavigationHistoryTracker } from '@/components/navigation-history-tracker'
import { Toaster } from '@/components/ui/sonner'
import { GlobalSocketProvider } from '@/components/global-socket-provider'

import './globals.css'


const _geistSans = Geist({ subsets: ['latin', 'cyrillic'] })
const _geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  /**
   * metadataBase превращает относительные пути в абсолютные для canonical и
   * Open Graph. Без него Next честно предупреждает при сборке и подставляет
   * localhost, из-за чего превью ссылок на проде ломается.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Видеоконсультации с врачами онлайн — smartcardio',
    /**
     * Суффикс бренда добавляется здесь один раз, поэтому на страницах
     * заголовок пишется без « — smartcardio»: иначе он удвоится.
     */
    template: `%s — ${SITE_NAME}`,
  },
  description:
    'Онлайн консультации с врачами. Запишитесь на видеоконсультацию не выходя из дома.',
  applicationName: SITE_NAME,
  // Иконки взяты с smartcardio.ru. favicon.ico и apple-icon.png лежат в src/app
  // и подхватываются Next по соглашению об именах; здесь объявлены явно, чтобы
  // список иконок был виден в одном месте с остальными метаданными.
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: 'Видеоконсультации с врачами онлайн — smartcardio',
    description:
      'Онлайн консультации с врачами. Запишитесь на видеоконсультацию не выходя из дома.',
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image' },
  // Формат телефона отключён: iOS иначе сам оборачивает числа в ссылки и портит
  // вёрстку цен и времени приёма.
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: BRAND_COLOR,
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="bg-background">
      <body className={`font-sans antialiased`} >
        <AppInit />
        <NavigationHistoryTracker />
        <GlobalSocketProvider>
          <Toaster position="top-center" richColors />
          {children}
        </GlobalSocketProvider>
      </body>
    </html>
  )
}
