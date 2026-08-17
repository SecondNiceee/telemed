'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useUserStore } from '@/stores/user-store'

export function VerifiedHomeAction() {
  const refetchUser = useUserStore((state) => state.refetchUser)
  const [isSynchronizing, setIsSynchronizing] = useState(true)

  useEffect(() => {
    let isMounted = true

    void refetchUser().finally(() => {
      if (isMounted) setIsSynchronizing(false)
    })

    return () => {
      isMounted = false
    }
  }, [refetchUser])

  if (isSynchronizing) {
    return (
      <Button className="w-full" disabled aria-busy="true">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Обновляем аккаунт…
      </Button>
    )
  }

  return (
    <Button asChild className="w-full">
      <Link href="/">На главную</Link>
    </Button>
  )
}
