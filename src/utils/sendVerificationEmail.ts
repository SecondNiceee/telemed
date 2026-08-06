import type { BasePayload } from 'payload'

interface SendVerificationEmailOptions {
  payload: BasePayload
  email: string
  name?: string
  token: string
}

function buildVerificationEmailHtml({
  name,
  email,
  verifyUrl,
}: {
  name?: string
  email: string
  verifyUrl: string
}): string {
  const displayName = name ?? email

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Подтверждение email</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#1a56db;padding:32px 40px;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">smartcardio</p>
              <p style="margin:6px 0 0;color:#a5c0f7;font-size:13px;">Телемедицина</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                Подтвердите ваш email
              </h1>
              <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
                Привет, <strong>${displayName}</strong>!
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                Вы зарегистрировались на платформе smartcardio. Для завершения регистрации подтвердите ваш email-адрес, нажав кнопку ниже.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1a56db;border-radius:10px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
                      Подтвердить email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                Или скопируйте эту ссылку в браузер:<br/>
                <a href="${verifyUrl}" style="color:#1a56db;word-break:break-all;">${verifyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Ссылка действительна 24 часа. Если вы не регистрировались на smartcardio — просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendVerificationEmail({
  payload,
  email,
  name,
  token,
}: SendVerificationEmailOptions): Promise<void> {
  const siteUrl = process.env.SERVER_URL || 'http://localhost:3000'
  const verifyUrl = `${siteUrl}/verify-email?token=${token}`

  const html = buildVerificationEmailHtml({ name, email, verifyUrl })

  await payload.sendEmail({
    to: email,
    subject: 'Подтвердите ваш email — smartcardio',
    html,
  })
}
