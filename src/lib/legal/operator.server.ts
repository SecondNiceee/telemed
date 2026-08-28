import 'server-only'

import { unstable_cache } from 'next/cache'
import { OPERATOR_FALLBACK, PLACEHOLDER, type OperatorRequisites } from './operator'

/**
 * Тег кэша реквизитов оператора.
 *
 * Совпадает с тегом, который сбрасывает хук глобала `site-settings`: реквизиты
 * живут в том же документе, поэтому отдельный тег означал бы, что после правки
 * в админке главная страница обновилась, а юридические документы - нет.
 */
export const SITE_SETTINGS_CACHE_TAG = 'site-settings'

/**
 * Реквизиты оператора из админки.
 *
 * Почему из БД, а не из константы: реквизиты - это данные, а не текст документа.
 * Их правит администратор при переезде офиса или смене телефона, и требовать для
 * этого правку кода с деплоем означало бы, что документы месяцами показывают
 * старый адрес для обращений по персональным данным.
 *
 * Кэш сбрасывается ТЕГОМ из хука глобала, а не по таймеру: юридическая страница
 * не должна час показывать прежнее наименование оператора.
 *
 * Пустое поле НЕ подменяется значением из кода: возвращается PLACEHOLDER, и
 * страница честно показывает «не заполнено» плюс уходит из индекса поиска.
 * Подстановка «разумного значения по умолчанию» здесь была бы худшим вариантом -
 * документ выглядел бы заполненным, называя оператором не то лицо.
 */
export const fetchOperatorRequisitesCached = unstable_cache(
  async (): Promise<OperatorRequisites> => {
    try {
      // getPayload ОБЯЗАН быть внутри try: он падает сам, если нет секрета или
      // строки подключения к БД. Та же регрессия уже ломала /legal/clinics -
      // страница отдавала 500 вместо честного пустого состояния.
      const [{ getPayload }, configModule] = await Promise.all([
        import('payload'),
        import('@/payload.config'),
      ])
      const payload = await getPayload({ config: configModule.default })

      const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
      const operator = settings?.operator

      if (!operator) return OPERATOR_FALLBACK

      // trim(): пробел в поле админки — это незаполненное поле, а не значение.
      const value = (raw?: string | null): string => {
        const trimmed = raw?.trim()
        return trimmed ? trimmed : PLACEHOLDER
      }

      return {
        legalName: value(operator.legalName),
        inn: value(operator.inn),
        ogrn: value(operator.ogrn),
        address: value(operator.address),
        email: value(operator.email),
        phone: value(operator.phone),
        hostingLocation: value(operator.hostingLocation),
        rknNotificationSubmitted: operator.rknNotificationSubmitted === true,
      }
    } catch (error) {
      console.error('[legal] Не удалось загрузить реквизиты оператора:', {
        error: error instanceof Error ? error.message : error,
      })
      // Заглушки -> документ покажет «не заполнено». Это честнее, чем печатать
      // реквизиты, за актуальность которых никто не отвечает.
      return OPERATOR_FALLBACK
    }
  },
  ['operator-requisites'],
  { tags: [SITE_SETTINGS_CACHE_TAG] },
)
