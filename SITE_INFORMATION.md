# Структура проекта Телемедицина

## Обзор системы

Платформа телемедицины с тремя типами пользователей:
- **Пациенты (Users)** - записываются на консультации, общаются с врачами
- **Врачи (Doctors)** - проводят консультации, видеозвонки
- **Организации (Organisations)** - управляют врачами и просматривают статистику

---

## Коллекции Payload CMS

| Коллекция | Файл | Описание |
|-----------|------|----------|
| `Users` | `src/collections/Users.ts` | Пациенты (email, password, role) |
| `Doctors` | `src/collections/Doctors.ts` | Врачи (ФИО, специализация, расписание, organisation) |
| `Organisations` | `src/collections/Organisations.ts` | Организации (name, email) |
| `Appointments` | `src/collections/Appointments.ts` | Консультации (user, doctor, date, time, status, connectionType) |
| `Messages` | `src/collections/Messages.ts` | Сообщения чата (appointment, sender, content, isSystemMessage) |
| `CallRecordings` | `src/collections/CallRecordings.ts` | Записи видеозвонков (appointment, doctor, video, duration) |
| `DoctorCategories` | `src/collections/DoctorCategories.ts` | Категории врачей |
| `Media` | `src/collections/Media.ts` | Медиа-файлы (изображения, видео) |

---

## Личные кабинеты

### 1. Личный кабинет пациента (`/lk`)

**Страницы:**
| Путь | Файл | Описание |
|------|------|----------|
| `/lk` | `src/app/(frontend)/lk/page.tsx` | Главная ЛК пациента |
| `/lk/chat` | `src/app/(frontend)/lk/chat/page.tsx` | Чат с врачами |

**Компоненты:**
- `LkGate` (`src/components/lk-gate.tsx`) - проверка авторизации
- `LkContent` (`src/components/lk-content.tsx`) - контент ЛК
- `ChatPage` (`src/components/chat/chat-page.tsx`) - страница чата
- `ChatSidebar` (`src/components/chat/chat-sidebar.tsx`) - список чатов
- `ChatWindow` (`src/components/chat/chat-window.tsx`) - окно чата

---

### 2. Личный кабинет врача (`/lk-med`)

**Страницы:**
| Путь | Файл | Описание |
|------|------|----------|
| `/lk-med` | `src/app/(frontend)/lk-med/page.tsx` | Главная ЛК врача |
| `/lk-med/login` | `src/app/(frontend)/lk-med/login/page.tsx` | Авторизация врача |
| `/lk-med/chat` | `src/app/(frontend)/lk-med/chat/page.tsx` | Чат врача с пациентами |

**Компоненты:**
- `LkMedGate` (`src/components/lk-med-gate.tsx`) - проверка авторизации врача
- `LkMedContent` (`src/components/lk-med-content.tsx`) - контент ЛК врача
- `DoctorChatWrapper` (`src/components/chat/doctor-chat-wrapper.tsx`) - обертка чата врача

---

### 3. Личный кабинет организации (`/lk-org`)

**Страницы:**
| Путь | Файл | Описание |
|------|------|----------|
| `/lk-org` | `src/app/(frontend)/lk-org/page.tsx` | Главная - список врачей + статистика |
| `/lk-org/doctor-create` | `src/app/(frontend)/lk-org/doctor-create/page.tsx` | Создание врача |
| `/lk-org/doctor-edit/[id]` | `src/app/(frontend)/lk-org/doctor-edit/[id]/page.tsx` | Редактирование врача |
| `/lk-org/doctor-schedule/[id]` | `src/app/(frontend)/lk-org/doctor-schedule/[id]/page.tsx` | Расписание врача |
| `/lk-org/doctor/[id]` | `src/app/(frontend)/lk-org/doctor/[id]/page.tsx` | Dashboard врача (консультации) |
| `/lk-org/doctor/[id]/consultation/[appointmentId]` | `src/app/(frontend)/lk-org/doctor/[id]/consultation/[appointmentId]/page.tsx` | Детали консультации (чат + записи) |
| `/lk-org/categories` | `src/app/(frontend)/lk-org/categories/page.tsx` | Категории врачей |
| `/lk-org/categories/create` | `src/app/(frontend)/lk-org/categories/create/page.tsx` | Создание категории |

**Компоненты главной страницы:**
- `LkOrgGate` (`src/components/lk-org-gate.tsx`) - проверка авторизации организации
- `LkOrgContent` (`src/components/lk-org-content.tsx`) - контент с карточками врачей и статистикой
- `OrgPageHeader` (`src/components/lk-org/OrgPageHeader.tsx`) - заголовок страницы
- `DoctorsListHeader` (`src/components/lk-org/DoctorsListHeader.tsx`) - заголовок списка врачей
- `OrgDoctorCard` (`src/components/lk-org/OrgDoctorCard.tsx`) - карточка врача (ссылка на `/lk-org/doctor/[id]`)
- `EmptyDoctorsList` (`src/components/lk-org/EmptyDoctorsList.tsx`) - пустой список
- `DeleteDoctorDialog` (`src/components/lk-org/DeleteDoctorDialog.tsx`) - диалог удаления

**Компоненты расписания:**
- `ScheduleCalendar` (`src/components/lk-org/schedule/ScheduleCalendar.tsx`) - календарь расписания
- `SlotEditor` (`src/components/lk-org/schedule/SlotEditor.tsx`) - редактор слотов
- `AddSlotInput` (`src/components/lk-org/schedule/AddSlotInput.tsx`) - добавление слота
- `ClockPicker` (`src/components/lk-org/schedule/ClockPicker.tsx`) - выбор времени
- `SlotDurationSelector` (`src/components/lk-org/schedule/SlotDurationSelector.tsx`) - длительность слота
- `ScheduleSummary` (`src/components/lk-org/schedule/ScheduleSummary.tsx`) - сводка расписания
- `SaveScheduleBar` (`src/components/lk-org/schedule/SaveScheduleBar.tsx`) - панель сохранения
- `WeekPatternDialog` (`src/components/lk-org/schedule/WeekPatternDialog.tsx`) - шаблон недели

**Компоненты консультации:**
- `OrgConsultationView` (`src/components/lk-org/consultation/OrgConsultationView.tsx`) - просмотр консультации с табами:
  - **Чат** - история сообщений (`MessageBubble`)
  - **Записи звонков** - список записей с видео-ссылками

---

## Система видеозвонков

**Провайдер:**
- `VideoCallProvider` (`src/components/video-call/video-call-provider.tsx`) - главный контекст видеозвонка

**Представления (Views):**
| Компонент | Файл | Описание |
|-----------|------|----------|
| `CallingView` | `src/components/video-call/views/calling-view.tsx` | Исходящий звонок |
| `IncomingCallView` | `src/components/video-call/views/incoming-call-view.tsx` | Входящий звонок |
| `ConnectingView` | `src/components/video-call/views/connecting-view.tsx` | Подключение |
| `ConnectedView` | `src/components/video-call/views/connected-view.tsx` | Активный звонок |
| `MinimizedView` | `src/components/video-call/views/minimized-view.tsx` | Свернутый звонок |

**UI-компоненты:**
| Компонент | Файл | Описание |
|-----------|------|----------|
| `VideoCallOverlay` | `src/components/video-call/video-call-overlay.tsx` | Оверлей звонка |
| `LocalVideo` | `src/components/video-call/components/local-video.tsx` | Локальное видео |
| `RemoteVideo` | `src/components/video-call/components/remote-video.tsx` | Удаленное видео |
| `CallControls` | `src/components/video-call/components/call-controls.tsx` | Управление звонком |
| `DoctorControls` | `src/components/video-call/components/doctor-controls.tsx` | Доп. контролы врача |
| `CallTimer` | `src/components/video-call/components/call-timer.tsx` | Таймер звонка |
| `ConnectionQuality` | `src/components/video-call/components/connection-quality.tsx` | Качество связи |
| `EndCallDialog` | `src/components/video-call/components/end-call-dialog.tsx` | Диалог завершения |

**Хуки:**
| Хук | Файл | Описание |
|-----|------|----------|
| `useMediaStream` | `src/components/video-call/hooks/use-media-stream.ts` | Управление медиа-потоком |
| `useCallTimer` | `src/components/video-call/hooks/use-call-timer.ts` | Таймер звонка |
| `useConnectionQuality` | `src/components/video-call/hooks/use-connection-quality.ts` | Мониторинг качества |
| `useCallRecording` | `src/components/video-call/hooks/use-call-recording.ts` | Запись звонка |

**Логика записи звонков (Chunks):**

Запись использует **периодическую отправку chunks** для надежности. Если врач закроет вкладку, потеряются только последние 30 секунд.

1. Врач начинает звонок → `VideoCallProvider` активирует `useCallRecording`
2. При подключении (`status === 'connected'`) начинается запись (только для врача)
3. **Каждые 30 секунд** chunks отправляются на `/api/recording-chunks`
4. При завершении звонка → `/api/recording-chunks/finalize` склеивает chunks
5. Создается `Media` (видео-файл) и `CallRecording` (запись в БД)

**API записи:**
| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/recording-chunks` | POST | Прием chunk видео |
| `/api/recording-chunks/finalize` | POST | Склейка и создание записи |

**Логи:** Все логи с префиксом `[Recording]` в консоли браузера врача.

**Подробнее:** см. `ABOUT_VIDEO.md` → раздел "Система записи звонков (Chunks)"

---

## Система чата

**Компоненты:**
| Компонент | Файл | Описание |
|-----------|------|----------|
| `ChatPage` | `src/components/chat/chat-page.tsx` | Страница чата |
| `ChatSidebar` | `src/components/chat/chat-sidebar.tsx` | Боковая панель со списком чатов |
| `ChatWindow` | `src/components/chat/chat-window.tsx` | Окно чата |
| `ChatHeader` | `src/components/chat/components/chat-header.tsx` | Заголовок чата (смена типа связи) |
| `ChatInput` | `src/components/chat/components/chat-input.tsx` | Ввод сообщения |
| `ChatMessages` | `src/components/chat/components/chat-messages.tsx` | Список сообщений |
| `MessageBubble` | `src/components/chat/message-bubble.tsx` | Пузырек сообщения (включая системные) |
| `ConsultationDialogs` | `src/components/chat/components/consultation-dialogs.tsx` | Диалоги консультации |
| `DragDropOverlay` | `src/components/chat/components/drag-drop-overlay.tsx` | Drag & drop файлов |
| `VideoSaveSidebar` | `src/components/chat/components/video-save-sidebar.tsx` | Сайдбар сохранения видео |
| `DoctorChatWrapper` | `src/components/chat/doctor-chat-wrapper.tsx` | Обертка чата врача |

**Типы сообщений:**
- **Обычные** - сообщения от пациента или врача (пузырек слева/справа)
- **Системные** (`isSystemMessage: true`) - уведомления по центру с горизонтальными линиями

**Предпочтительный тип связи (`connectionType`):**
- Устанавливается пациентом при записи на консультацию (`/doctor/[id]/booking`)
- Можно изменить в чате пациента (`/lk/chat?appointment={id}`) через dropdown в хедере
- При изменении создаётся системное сообщение для информирования врача
- Варианты: `chat` (Чат), `audio` (Аудио), `video` (Видео)

---

## API клиенты

| Файл | Описание |
|------|----------|
| `src/lib/api/fetch.ts` | Базовые функции fetch (клиент + сервер) |
| `src/lib/api/auth.ts` | Авторизация пациентов |
| `src/lib/api/doctor-auth.ts` | Авторизация врачей |
| `src/lib/api/org-auth.ts` | Авторизация организаций |
| `src/lib/api/doctors.ts` | API врачей |
| `src/lib/api/appointments.ts` | API консультаций |
| `src/lib/api/messages.ts` | API сообщений |
| `src/lib/api/call-recordings.ts` | API записей звонков |
| `src/lib/api/categories.ts` | API категорий |
| `src/lib/api/types.ts` | TypeScript типы |

---

## Админка Payload CMS

**Путь:** `/admin`

**Файлы:**
- `src/app/(payload)/admin/[[...segments]]/page.tsx` - страница админки
- `src/app/(payload)/admin/[[...segments]]/not-found.tsx` - 404

**Доступ:** Только пользователи с `role: 'admin'` в коллекции `Users`

**Возможности:**
- Управление всеми коллекциями (Users, Doctors, Appointments, Messages, CallRecordings, etc.)
- Просмотр и редактирование данных
- Загрузка медиа-файлов

---

## Статистика организации

На главной странице `/lk-org` отображаются карточки статистики:

| Счетчик | Описание |
|---------|----------|
| **Всего консультаций** | Все консультации врачей организации (кроме отмененных) |
| **Предстоящих** | Консультации со статусом `scheduled` и датой в будущем |
| **Прошедших** | Консультации со статусом `completed` или датой в прошлом |

**Реализация:**
- Данные фетчатся на сервере в `page.tsx`
- Используется `AppointmentsApi.fetchByDoctorsServer()` для получения всех консультаций врачей организации
- Статистика передается в `LkOrgContent` через `initialStats`

---

## Поток данных: Консультация → Запись

```
1. Пациент записывается на консультацию
   └── Создается Appointment (status: 'scheduled')

2. Врач начинает видеозвонок
   └── VideoCallProvider → useCallRecording.startRecording(stream, appointmentId, doctorId)
   └── Генерируется sessionId для этой записи

3. Во время звонка (каждые 30 сек)
   └── useCallRecording отправляет chunks
   └── POST /api/recording-chunks
   └── Chunks сохраняются в /tmp/recording-chunks/{sessionId}/

4. Звонок завершается
   └── useCallRecording.stopRecording()
   └── POST /api/recording-chunks/finalize
   └── Сервер склеивает chunks → загружает в Media → создает CallRecording

5. Организация просматривает консультацию
   └── /lk-org/doctor/[id]/consultation/[appointmentId]
   └── OrgConsultationView (таб "Записи звонков")
   └── Отображается список CallRecordings с видео-ссылками
```

---

## Логика завершения консультации

### Из чата врача (`/lk-med/chat`)

Когда врач нажимает **"Завершить консультацию"** в чате:

1. **UI взаимодействие:**
   - Показывается `AlertDialog` с подтверждением (`ConsultationDialogs`)

2. **При подтверждении (`handleCompleteAppointment`):**
   ```
   ChatWindow → endConsultation(appointmentId) через socket
   → Сервер обновляет status на 'completed'
   → Эмитится 'consultation-ended' всем участникам
   ```

3. **Результат:**
   - `localStatus` обновляется на `'completed'`
   - Вызывается `onAppointmentCompleted?.(appointmentId)` для обновления списка чатов
   - **Чат остается открытым** - пациент может продолжать писать
   - Появляется кнопка "Запретить пациенту писать"

### Блокировка/Разблокировка чата

После завершения консультации врач может управлять доступом пациента к чату:

1. **Кнопка "Запретить пациенту писать":**
   - Отправляет `chat-block` событие через socket
   - Устанавливает `chatBlocked = true` в БД
   - Пациент видит "Врач окончательно завершил консультацию"
   - Кнопка меняется на "Разрешить пациенту писать"

2. **Кнопка "Разрешить пациенту писать":**
   - Отправляет `chat-unblock` событие через socket
   - Устанавливает `chatBlocked = false` в БД
   - Пациент снова может писать
   - Кнопка меняется обратно на "Запретить пациенту писать"

**Важно:** Врач всегда может отправлять сообщения, независимо от статуса блокировки.

### Из видеозвонка (кнопка "Завершить консультацию")

Когда врач завершает звонок с записью:

1. **Завершение звонка:**
   - `VideoCallProvider.endCall()` останавливает соединение
   - `useCallRecording.stopRecording()` останавливает запись

2. **Сохранение записи:**
   - Если использовались chunks: `finalizeRecording()` склеивает на сервере
   - Fallback: загрузка всего blob через `/api/media`
   - Создается `CallRecording` в БД

3. **Завершение appointment:**
   - `handleConsultationComplete(recordingBlob)` в `ChatWindow`
   - `AppointmentsApi.complete(appointmentId)`
   - Status меняется на `'completed'`
   - Toast: "Консультация завершена"

### Файлы логики завершения

| Файл | Функция |
|------|---------|
| `src/components/chat/chat-window.tsx` | `handleCompleteAppointment()`, `handleConsultationComplete()` |
| `src/components/chat/components/consultation-dialogs.tsx` | UI диалога подтверждения |
| `src/components/chat/components/chat-header.tsx` | Кнопка "Завершить консультацию" |
| `src/lib/api/appointments.ts` | `AppointmentsApi.complete()` |
| `src/app/api/appointments/[id]/complete/route.ts` | API endpoint |
| `src/components/video-call/hooks/use-call-recording.ts` | Сохранение записи |

---

## Аутентификация

**Токены (cookies):**
| Cookie | Коллекция | Использование |
|--------|-----------|---------------|
| `payload-token` | Users | Пациенты |
| `doctors-token` | Doctors | Врачи |
| `organisations-token` | Organisations | Организации |

**Проверка на сервере:**
- `getSessionFromCookie()` (`src/lib/auth/getSessionFromCookie.ts`)
- `getCallerFromRequest()` (`src/collections/helpers/auth.ts`)

**Access Control:**
- Каждая коллекция имеет свои правила доступа в поле `access`
- Организации могут читать данные своих врачей
- Врачи могут читать только свои консультации
- Пациенты могут читать только свои данные
