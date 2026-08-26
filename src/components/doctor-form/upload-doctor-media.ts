/**
 * Загружает файл в коллекцию media и возвращает его id.
 *
 * Одна и та же функция была объявлена внутри onSubmit в create и в edit -
 * то есть пересоздавалась на каждую отправку формы и правилась в двух местах.
 *
 * Возвращает именно id, а не документ: вызывающему нужен только он, чтобы
 * сослаться на файл из врача и, если сохранение врача упадёт, удалить
 * осиротевшие загрузки.
 */
export async function uploadDoctorMedia(
  file: File,
  alt: string,
): Promise<number | null> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("alt", alt)
  formData.append("_payload", JSON.stringify({ alt }))

  const uploadRes = await fetch("/api/media", {
    method: "POST",
    credentials: "include",
    body: formData,
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.json().catch(() => null)
    console.error("[lk-org] Photo upload failed:", {
      status: uploadRes.status,
      statusText: uploadRes.statusText,
      body,
    })
    throw new Error(body?.errors?.[0]?.message || "Ошибка загрузки фото")
  }

  const uploadData = await uploadRes.json()
  return (uploadData.doc?.id ?? null) as number | null
}
