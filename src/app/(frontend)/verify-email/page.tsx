// app/verify-email/page.tsx
import { VerifyEmailClient } from "./verify-email-client"

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }> | { token?: string }
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await Promise.resolve(searchParams)
  const token = params.token

  // Подтверждение выполняется на клиенте: роут /api/auth/verify-email выдаёт
  // cookie сессии, которую нужно сохранить именно в браузере, а стор
  // пользователя обновить, чтобы шапка сразу показала вошедший аккаунт.
  return <VerifyEmailClient token={token} />
}
