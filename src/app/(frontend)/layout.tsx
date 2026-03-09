import React from "react"
import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'


export const metadata: Metadata = {
  title: 'smartcardio Телемедицина',
  description: 'Онлайн консультации с лучшими врачами. Запишитесь на прием не выходя из дома.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" >
      <body className={`font-sans antialiased`} >
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  )
}
