# Система отзывов (Feedbacks)

## Обзор

Система отзывов позволяет пациентам оставлять отзывы о врачах после завершения консультации. Каждый отзыв привязан к трём сущностям:

1. **Пациент (user)** - кто оставил отзыв
2. **Врач (doctor)** - кому оставлен отзыв
3. **Консультация (appointment)** - по какой консультации

## Коллекция Feedbacks

**Путь:** `src/collections/Feedbacks.ts`

### Поля коллекции

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `user` | relationship → users | Да | Пациент, оставивший отзыв |
| `doctor` | relationship → doctors | Да | Врач, которому оставлен отзыв |
| `appointment` | relationship → appointments | Да | Консультация |
| `rating` | number (1-5) | Да | Оценка в звёздах |
| `text` | textarea | Нет | Текст отзыва |

### Правила доступа

| Действие | Кто может |
|----------|-----------|
| **read** | Все (отзывы публичны для отображения на профиле врача) |
| **create** | Только авторизованные пользователи (patients) |
| **update** | Только админ |
| **delete** | Только админ |

### Валидация при создании

1. Пользователь не может оставить более одного отзыва на одну консультацию
2. Отзыв можно оставить только для завершённых консультаций (`status: 'completed'`)
3. Пользователь может оставить отзыв только для своих консультаций

## Компоненты

### FeedbackPrompt

**Путь:** `src/components/feedback-prompt.tsx`

Компонент-баннер, который показывается в личном кабинете пользователя (`/lk`) когда есть завершённые консультации без отзыва.

**Логика работы:**
1. Получает список записей пользователя
2. Фильтрует завершённые консультации
3. Для каждой проверяет, есть ли отзыв через API
4. Показывает баннер для первой консультации без отзыва

**UI:**
- Текст: "Вы недавно прошли консультацию с врачом {ИМЯ_ВРАЧА}"
- Кнопка "Оставить отзыв"
- Кнопка закрытия (X) для временного скрытия

### FeedbackDialog

**Путь:** `src/components/feedback-dialog.tsx`

Модальное окно для ввода отзыва.

**Props:**
```typescript
interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorName: string
  doctorId: number
  appointmentId: number
  userId: number
  onSuccess?: () => void
}
```

**Содержимое:**
- Заголовок: "Оставить отзыв"
- Описание с именем врача
- Интерактивный выбор звёзд (1-5)
- Текстовое поле для отзыва (необязательное, до 1000 символов)
- Кнопки "Отмена" и "Отправить отзыв"

**Поведение звёзд:**
- При наведении подсвечиваются звёзды до текущей
- При клике сохраняется выбранная оценка
- Текстовая подсказка: Плохо (1), Не очень (2), Нормально (3), Хорошо (4), Отлично (5)

### DoctorReviews

**Путь:** `src/components/doctor-reviews.tsx`

Секция отзывов на странице профиля врача (`/doctor/{id}`).

**Props:**
```typescript
interface DoctorReviewsProps {
  doctorId: number
  doctorName: string
}
```

**Функционал:**
- Отображает все отзывы врача с рейтингом, датой и текстом
- Кнопка "Оставить отзыв" для авторизованных пользователей
- При нажатии проверяет, есть ли у пользователя завершённые консультации с этим врачом без отзыва
- Если консультация одна — сразу открывает FeedbackDialog
- Если консультаций несколько — открывает ConsultationSelectDialog для выбора

**UI элементы:**
- Заголовок "Отзывы пациентов" с кнопкой
- Карточки отзывов: аватар (инициалы), имя, дата, звёзды, текст
- Состояние загрузки (skeleton)
- Пустое состояние "Отзывов пока нет"

### ConsultationSelectDialog

**Путь:** `src/components/consultation-select-dialog.tsx`

Модальное окно для выбора консультации при оставлении отзыва (когда у пользователя несколько завершённых консультаций с врачом).

**Props:**
```typescript
interface ConsultationSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointments: ApiAppointment[]
  onSelect: (appointment: ApiAppointment) => void
  isLoading?: boolean
}
```

**Функционал:**
- Показывает список завершённых консультаций без отзыва
- Отображает дату, специальность и тип консультации
- При выборе вызывает `onSelect` и закрывает диалог

### ChatHeader (обновлён)

**Путь:** `src/components/chat/components/chat-header.tsx`

**Новые props:**
```typescript
hasFeedback?: boolean      // Есть ли уже отзыв на эту консультацию
onLeaveFeedback?: () => void  // Callback для открытия диалога отзыва
```

**Новый функционал:**
- Кнопка "Оставьте отзыв о враче" в баннере завершённой консультации
- Показывается только пациентам (`currentSenderType === 'user'`)
- Скрывается, если отзыв уже оставлен (`hasFeedback === true`)

## Zustand Store

### useFeedbackStore

**Путь:** `src/stores/feedback-store.ts`

Централизованное управление состоянием отзывов с кэшированием.

**State:**
```typescript
interface FeedbackState {
  // Отзывы по врачу (кэш)
  feedbacksByDoctor: Record<number, ApiFeedback[]>
  loadingByDoctor: Record<number, boolean>
  
  // Проверка наличия отзыва по appointment
  feedbackExistsByAppointment: Record<number, boolean>
  
  // Консультации пользователя без отзыва (для выбора)
  userCompletedAppointmentsWithoutFeedback: ApiAppointment[]
  loadingUserAppointments: boolean
}
```

**Actions:**
```typescript
// Загрузить отзывы врача (с кэшированием)
loadFeedbacksByDoctor(doctorId: number, forceRefresh?: boolean): Promise<ApiFeedback[]>

// Проверить, есть ли отзыв на консультацию
checkFeedbackExists(appointmentId: number): Promise<boolean>

// Установить флаг наличия отзыва (после создания)
setFeedbackExists(appointmentId: number, exists: boolean): void

// Добавить отзыв в кэш (после создания)
addFeedback(feedback: ApiFeedback): void

// Загрузить консультации пользователя без отзыва для конкретного врача
loadUserCompletedAppointmentsWithoutFeedback(
  doctorId: number, 
  allAppointments: ApiAppointment[]
): Promise<void>
```

**Использование:**
```tsx
const { 
  feedbacksByDoctor, 
  loadFeedbacksByDoctor,
  checkFeedbackExists,
  setFeedbackExists 
} = useFeedbackStore()

// В ChatWindow - проверка наличия отзыва
useEffect(() => {
  if (isCompleted) {
    checkFeedbackExists(appointment.id)
  }
}, [appointment.id, isCompleted])

// В DoctorReviews - загрузка отзывов
useEffect(() => {
  loadFeedbacksByDoctor(doctorId)
}, [doctorId])
```

## API

### FeedbacksApi

**Путь:** `src/lib/api/feedbacks.ts`

```typescript
FeedbacksApi.create(data)       // Создать отзыв
FeedbacksApi.getByAppointment(appointmentId)  // Получить отзыв по консультации
FeedbacksApi.getByDoctor(doctorId)   // Все отзывы врача (depth=2 для user info)
FeedbacksApi.getByUser(userId)       // Все отзывы пользователя
FeedbacksApi.hasFeedback(appointmentId)  // Проверить наличие отзыва
```

### Типы

**Путь:** `src/lib/api/types.ts`

```typescript
interface ApiFeedback {
  id: number
  user: { id: number; name?: string | null; email: string } | number
  doctor: ApiDoctor | number
  appointment: ApiAppointment | number
  rating: number
  text?: string | null
  createdAt: string
  updatedAt: string
}
```

## Поток данных

```
Пользователь                    Frontend                        Backend
     │                              │                              │
     │ 1. Заходит в /lk             │                              │
     │ ────────────────────────────>│                              │
     │                              │                              │
     │                              │ 2. Загружает appointments    │
     │                              │ ────────────────────────────>│
     │                              │                              │
     │                              │ 3. Для completed проверяет   │
     │                              │    наличие feedbacks         │
     │                              │ ────────────────────────────>│
     │                              │                              │
     │ 4. Видит баннер              │<────────────────────────────│
     │    "Оставить отзыв"          │                              │
     │                              │                              │
     │ 5. Нажимает кнопку           │                              │
     │ ────────────────────────────>│                              │
     │                              │                              │
     │ 6. Видит диалог с            │                              │
     │    звёздами и полем ввода    │                              │
     │                              │                              │
     │ 7. Выбирает оценку,          │                              │
     │    пишет текст,              │                              │
     │    нажимает "Отправить"      │                              │
     │ ────────────────────────────>│                              │
     │                              │                              │
     │                              │ 8. POST /api/feedbacks       │
     │                              │ ────────────────────────────>│
     │                              │                              │
     │                              │ 9. Валидация и сохранение    │
     │                              │<────────────────────────────│
     │                              │                              │
     │ 10. Уведомление "Отзыв       │                              │
     │     успешно отправлен"       │                              │
     │<────────────────────────────│                              │
     │                              │                              │
     │ 11. Баннер скрывается        │                              │
```

## Интеграция с LK

**Файл:** `src/components/lk-content.tsx`

```tsx
import { FeedbackPrompt } from "@/components/feedback-prompt"

// В компоненте:
<FeedbackPrompt appointments={appointments} userId={user.id} />
```

Компонент размещается в начале секции с записями, перед фильтрами и списком.

## Места, где можно оставить отзыв

### 1. Личный кабинет (`/lk`)
- Компонент `FeedbackPrompt` показывает баннер для консультаций без отзыва
- Пользователь видит сразу после входа в ЛК

### 2. Страница чата (`/lk/chat?appointment={id}`)
- Кнопка "Оставьте отзыв о враче" в шапке (при `status === 'completed'`)
- Показывается только если отзыв ещё не оставлен
- Проверка через `useFeedbackStore.checkFeedbackExists()`

### 3. Страница врача (`/doctor/{id}`)
- Секция "Отзывы пациентов" с компонентом `DoctorReviews`
- Кнопка "Оставить отзыв" доступна авторизованным пользователям
- При клике проверяется наличие завершённых консультаций с этим врачом
- Если консультаций несколько — показывается `ConsultationSelectDialog`

## Будущие улучшения (TODO)

- [x] Отображение отзывов на странице врача
- [x] Кнопка оставить отзыв на странице чата (завершённая консультация)
- [x] Выбор консультации при нескольких завершённых
- [ ] Расчёт среднего рейтинга врача
- [ ] Возможность ответа врача на отзыв
- [ ] Модерация отзывов админом
- [ ] Уведомление врача о новом отзыве
