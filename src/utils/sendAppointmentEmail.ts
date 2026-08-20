import type { BasePayload } from 'payload'

interface SendAppointmentEmailOptions {
  payload: BasePayload
  doctorEmail: string
  doctorName: string
  patientName: string
  specialty: string
  date: string
  time: string
  price: number
}

interface SendPatientAppointmentEmailOptions {
  payload: BasePayload
  patientEmail: string
  patientName: string
  doctorName: string
  specialty: string
  date: string
  time: string
  price: number
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildAppointmentEmailHtml({
  doctorName,
  patientName,
  specialty,
  date,
  time,
  price,
}: Omit<SendAppointmentEmailOptions, 'payload' | 'doctorEmail'>): string {
  const formattedDate = formatDateRu(date)

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Новая запись на консультацию</title>
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
              <p style="margin:6px 0 0;color:#a5c0f7;font-size:13px;">Видеоконсультация с врачом</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                Новая запись на консультацию
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Здравствуйте, <strong>${doctorName}</strong>! К вам записался новый пациент.
              </p>

              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;width:140px;">Пациент:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${patientName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Специальность:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${specialty}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Дата:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Время:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${time}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Стоимость:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${price.toLocaleString('ru-RU')} &#8381;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                Подробности и управление записями доступны в вашем
                <a href="${process.env.SERVER_URL || 'http://localhost:3000'}/lk-med" style="color:#1a56db;text-decoration:underline;">личном кабинете</a>.
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
                Это автоматическое уведомление от платформы smartcardio. Если у вас есть вопросы, обратитесь в поддержку.
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

export async function sendAppointmentEmail({
  payload,
  doctorEmail,
  doctorName,
  patientName,
  specialty,
  date,
  time,
  price,
}: SendAppointmentEmailOptions): Promise<void> {
  const html = buildAppointmentEmailHtml({
    doctorName,
    patientName,
    specialty,
    date,
    time,
    price,
  })

  await payload.sendEmail({
    to: doctorEmail,
    subject: `Новая запись на консультацию — ${patientName}, ${formatDateRu(date)}`,
    html,
  })
}

function buildPatientAppointmentEmailHtml({
  patientName,
  doctorName,
  specialty,
  date,
  time,
  price,
}: Omit<SendPatientAppointmentEmailOptions, 'payload' | 'patientEmail'>): string {
  const formattedDate = formatDateRu(date)

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ваша запись подтверждена</title>
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
              <p style="margin:6px 0 0;color:#a5c0f7;font-size:13px;">Видеоконсультация с врачом</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                Ваша запись подтверждена!
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Здравствуйте, <strong>${patientName}</strong>! Вы успешно записались на консультацию.
              </p>

              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;width:140px;">Врач:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${doctorName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Специальность:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${specialty}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Дата:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Время:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${time}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#6b7280;">Стоимость:</td>
                        <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${price.toLocaleString('ru-RU')} &#8381;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:14px;color:#374151;line-height:1.6;">
                Подробности и управление записями доступны в вашем
                <a href="${process.env.SERVER_URL || 'http://localhost:3000'}/lk" style="color:#1a56db;text-decoration:underline;">личном кабинете</a>.
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
                Это автоматическое уведомление от платформы smartcardio. Если у вас есть вопросы, обратитесь в поддержку.
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

export async function sendAppointmentCancellationEmail({
  payload,
  patientEmail,
  patientName,
  doctorName,
  date,
  time,
  reason,
}: {
  payload: { sendEmail: (options: { to: string; subject: string; html: string }) => Promise<unknown> }
  patientEmail: string
  patientName: string
  doctorName: string
  date: string
  time: string
  reason: string
}): Promise<void> {
  await payload.sendEmail({
    to: patientEmail,
    subject: `Консультация отменена — ${doctorName}, ${formatDateRu(date)}`,
    html: `<!DOCTYPE html><html lang="ru"><body style="margin:0;padding:32px;background:#f4f6fb;font-family:Arial,sans-serif;color:#111827"><main style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px"><h1 style="font-size:22px">Консультация отменена</h1><p>Здравствуйте, <strong>${patientName}</strong>.</p><p>Консультация с врачом <strong>${doctorName}</strong> ${formatDateRu(date)} в ${time} была отменена.</p><p><strong>Причина:</strong> ${reason}</p><p style="color:#6b7280;font-size:13px">Это автоматическое уведомление платформы smartcardio.</p></main></body></html>`,
  })
}

export async function sendPatientAppointmentEmail({
  payload,
  patientEmail,
  patientName,
  doctorName,
  specialty,
  date,
  time,
  price,
}: SendPatientAppointmentEmailOptions): Promise<void> {
  const html = buildPatientAppointmentEmailHtml({
    patientName,
    doctorName,
    specialty,
    date,
    time,
    price,
  })

  await payload.sendEmail({
    to: patientEmail,
    subject: `Запись подтверждена — ${doctorName}, ${formatDateRu(date)}`,
    html,
  })
}
