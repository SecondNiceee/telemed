/**
 * Реквизиты оператора персональных данных и версии юридических документов.
 *
 * Всё, что нужно подставить руками, собрано здесь - чтобы не искать по тексту
 * документов. Пока значение равно PLACEHOLDER, страница показывает заметный
 * блок «документ не заполнен».
 *
 * Так сделано намеренно. Незаполненный шаблон, опубликованный как готовый
 * документ, хуже отсутствия документа: он выглядит официальным, но не называет
 * оператора - то есть не выполняет требование ст. 18.1 152-ФЗ и вводит человека
 * в заблуждение. Видимая пометка «черновик» честнее, чем «ООО ___» в тексте,
 * который никто не перечитал.
 */

/** Маркер незаполненного значения. */
export const PLACEHOLDER = '___'

export interface OperatorRequisites {
  /** Полное наименование юрлица платформы, например ООО «Смарткардио». */
  legalName: string
  /** ИНН. */
  inn: string
  /** ОГРН. */
  ogrn: string
  /** Юридический адрес. */
  address: string
  /** Адрес для обращений по персональным данным. */
  email: string
  /** Телефон для обращений. */
  phone: string
  /**
   * Дата, с которой действует редакция документов.
   * Формат ISO (YYYY-MM-DD) - выводится через toLocaleDateString('ru-RU').
   */
  documentsDate: string
  /**
   * Где физически размещены серверы с базой и файлами - страна и, если
   * известно, город или провайдер.
   *
   * Для граждан РФ база данных должна находиться на территории России
   * (ч. 5 ст. 18 152-ФЗ). По коду это не проверяется никак: адрес VPS в
   * репозитории не хранится, поэтому значение заполняется руками.
   */
  hostingLocation: string
  /**
   * Уведомлён ли Роскомнадзор об обработке персональных данных.
   *
   * Для данных о здоровье уведомление обязательно (ст. 22 152-ФЗ), и отсутствие
   * его - самостоятельное нарушение, не зависящее от текста политики. Здесь
   * только флаг для памятки: код на него не опирается.
   */
  rknNotificationSubmitted: boolean
}

/**
 * ЗАПОЛНИТЬ ПЕРЕД ПУБЛИКАЦИЕЙ.
 *
 * Данные должны совпадать с ЕГРЮЛ: политика с чужим или неточным наименованием
 * оператора не защищает, а фиксирует нарушение.
 */
export const OPERATOR: OperatorRequisites = {
  legalName: PLACEHOLDER,
  inn: PLACEHOLDER,
  ogrn: PLACEHOLDER,
  address: PLACEHOLDER,
  email: PLACEHOLDER,
  phone: PLACEHOLDER,
  hostingLocation: PLACEHOLDER,
  documentsDate: '2026-08-27',
  rknNotificationSubmitted: false,
}

/**
 * Версия текста согласия на обработку персональных данных.
 *
 * Сохраняется вместе с отметкой пользователя. Менять при любой правке текста:
 * иначе нельзя будет сказать, под какой формулировкой человек поставил галочку,
 * а подтверждать придётся именно ту, которую он видел.
 */
export const PDN_CONSENT_VERSION = '2026-08-27'

/** Есть ли незаполненные реквизиты - страницы показывают предупреждение. */
export function hasUnfilledRequisites(): boolean {
  return [
    OPERATOR.legalName,
    OPERATOR.inn,
    OPERATOR.ogrn,
    OPERATOR.address,
    OPERATOR.email,
    OPERATOR.phone,
    OPERATOR.hostingLocation,
  ].some((value) => value.trim() === '' || value.includes(PLACEHOLDER))
}

/** Наименование оператора для подстановки в текст документов. */
export function operatorName(): string {
  return OPERATOR.legalName.includes(PLACEHOLDER) ? 'Оператор (наименование не заполнено)' : OPERATOR.legalName
}

/** Дата редакции документов в человекочитаемом виде. */
export function documentsDateLabel(): string {
  return new Date(OPERATOR.documentsDate).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
