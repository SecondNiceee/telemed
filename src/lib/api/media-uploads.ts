/**
 * Уборка media, загруженных «на опережение».
 *
 * Формы врача сначала кладут файлы в media, а уже потом сохраняют самого врача.
 * Если второй запрос упал (дубль email, валидация, сеть), файлы остаются в
 * коллекции навсегда: хук doctors чистит только то, на что врач когда-то
 * ссылался, а эти ссылки не получили.
 */
export async function deleteOrphanedUploads(ids: number[]): Promise<void> {
  const unique = [...new Set(ids.filter((id) => id != null))]
  if (unique.length === 0) return

  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await fetch(`/api/media/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) {
          console.error('[lk-org] failed to delete orphaned upload', {
            id,
            status: res.status,
          })
        }
      } catch (error) {
        // Мусорный файл не должен подменять исходную ошибку сохранения.
        console.error('[lk-org] failed to delete orphaned upload', { id, error })
      }
    }),
  )
}
