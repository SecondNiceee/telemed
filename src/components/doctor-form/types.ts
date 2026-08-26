/**
 * Общая форма данных врача для создания и редактирования.
 *
 * Раньше этот интерфейс был объявлен дважды - в lk-org-doctor-create и
 * lk-org-doctor-edit - и отличался ровно одним символом: в create пароль был
 * обязательным полем, в edit опциональным. Такое расхождение легко пропустить
 * при правке одного файла, поэтому тип теперь один.
 *
 * Пароль здесь опционален, потому что это описание ЗНАЧЕНИЙ формы, а не правил
 * валидации. Обязательность пароля - свойство конкретного экрана (при создании
 * он нужен, при редактировании означает "не менять"), и задаётся она через
 * passwordMode в DoctorFormFields, где и живёт register c required.
 */
export interface DoctorFormValues {
  name: string
  email: string
  password?: string
  categories: number[]
  experience: string
  degree: string
  price: string
  bio: string
  education: { value: string }[]
  services: { value: string }[]
}

/** Пустая форма: одно поле образования и одна услуга, чтобы список не был пуст. */
export const doctorFormDefaults: DoctorFormValues = {
  name: "",
  email: "",
  password: "",
  categories: [],
  experience: "",
  degree: "",
  price: "",
  bio: "",
  education: [{ value: "" }],
  services: [{ value: "" }],
}

/**
 * Обрезает значения списка и выбрасывает пустые.
 *
 * Одинаково нужно и education, и services, и в обоих экранах - то есть четыре
 * копии одного и того же кода до этого рефакторинга.
 */
export function toListField(items: { value: string }[]): { value: string }[] {
  return items
    .map((item) => item.value.trim())
    .filter(Boolean)
    .map((value) => ({ value }))
}
