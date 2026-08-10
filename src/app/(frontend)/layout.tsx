import React from "react"
import type { Metadata } from 'next'
import { AppInit } from '@/components/app-init'
import { Toaster } from '@/components/ui/sonner'
import { GlobalSocketProvider } from '@/components/socket-provider'
import { VideoCallProviderWrapper, VideoCallOverlay } from '@/components/video-call'

import './globals.css'


export const metadata: Metadata = {
  title: 'smartcardio Видеоконсультация с врачом',
  description: 'Онлайн консультации с врачами. Запишитесь на видеоконсультацию не выходя из дома.',
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
        <GlobalSocketProvider>
          <VideoCallProviderWrapper>
            <Toaster position="top-center" richColors />
            <VideoCallOverlay />
            {children}
          </VideoCallProviderWrapper>
        </GlobalSocketProvider>
      </body>
    </html>
  )
}
