import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserFromCookies } from '@/lib/server/route-auth'
import { getClientIp } from '@/utils/clientIp'

/**
 * Обращение пациента об отзыве согласия на обработку персональных данных.
 *
 * Что этот роут делает и чего НЕ делает
 * -------------------------------------
 * Он только фиксирует обращение: состояние, дату и адрес. Самого обезличивания
 * здесь нет, и это осознанно. Исполнение необратимо удаляет записи консультаций
 * и переписку, которые относятся не только к пациенту, но и к врачу, поэтому
 * решение принимает администратор в админке. Роль этого роута - зафиксировать
 * момент обращения: с него идёт срок на рассмотрение, и подтвердить дату
 * оператор сможет только собственной записью.
 *
 * Почему нельзя было обойтись правкой профиля с фронтенда
 * ------------------------------------------------------
 * Поля группы dataProcessing закрыты для записи всем, кроме администратора
 * (adminOnlyField в Users). Это не перестраховка: иначе пациент мог бы запросом
 * к REST API выставить себе `status: 'revoked'` и запустить необратимое удаление
 * напрямую, минуя рассмотрение. Роут ходит через Local API, где проверка прав
 * уже сделана здесь.
 *
 * Идемпотентность: повторный запрос при поданной заявке возвращает 200 и то же
 * состояние. Двойной клик по кнопке не должен выглядеть как ошибка и не должен
 * сдвигать дату обращения - иначе срок рассмотрения обнулялся бы при каждом
 * нажатии.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getUserFromCookies()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  try {
    const payload = await getPayload({ config })

    const current = await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })

    if (!current) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const dataProcessing = (current.dataProcessing ?? {}) as Record<string, unknown>
    const status = dataProcessing.status as string | undefined

    // Согласие уже отозвано - обращаться повторно некуда.
    if (status === 'revoked') {
      return NextResponse.json(
        {
          status: 'revoked',
          message: 'Согласие уже отозвано, данные обезличены.',
        },
        { status: 200 },
      )
    }

    // Заявка уже есть: возвращаем её дату, не перезаписывая.
    if (status === 'requested') {
      return NextResponse.json(
        {
          status: 'requested',
          requestedAt: dataProcessing.requestedAt ?? null,
          message: 'Заявка уже принята и рассматривается.',
        },
        { status: 200 },
      )
    }

    const requestedAt = new Date().toISOString()

    // Группа переписывается целиком поверх прочитанных значений: передача
    // частичного объекта затёрла бы соседние поля группы.
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        dataProcessing: {
          ...dataProcessing,
          status: 'requested',
          requestedAt,
          requestIp: getClientIp(request),
          // Отметку подтверждения заявка не ставит: её проставляет
          // администратор при исполнении.
          confirmErasure: false,
        },
      } as Record<string, unknown>,
      overrideAccess: true,
    })

    return NextResponse.json(
      {
        status: 'requested',
        requestedAt,
        message: 'Заявка на отзыв согласия принята.',
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[account/revoke-consent] не удалось зафиксировать обращение:', err)
    return NextResponse.json({ error: 'Не удалось принять заявку' }, { status: 500 })
  }
}
