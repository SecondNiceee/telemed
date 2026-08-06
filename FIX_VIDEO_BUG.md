# Исправление бага: Входящий звонок не отображается при перезагрузке страницы

## Описание проблемы

Когда врач инициировал звонок пациенту, а пациент:
1. Подключался к системе на несколько секунд позже
2. Перезагружал страницу во время входящего звонка

В обоих случаях пациент не видел входящий звонок и не мог его принять.

## Причина проблемы

1. **Отсутствие хранения активных звонков**: Звонок отправлялся только текущим подключенным сокетам. Если пациент не был подключен в момент инициации звонка, он его не получал.

2. **Неправильная маршрутизация**: Звонки отправлялись ВСЕМ пользователям определенного типа (user/doctor), а не конкретному получателю.

3. **Отсутствие проверки pending calls при подключении**: При новом подключении сокета не проверялись ожидающие звонки.

## Внесенные изменения

### 1. Добавлен Active Calls Store

**Файл:** `src/lib/socket/stores/activeCallsStore.ts`

Создано хранилище активных звонков в памяти сервера:

```typescript
interface ActiveCall {
  appointmentId: number
  callerPeerId: string
  callerName: string
  callerType: 'user' | 'doctor'
  callerId: number
  targetType: 'user' | 'doctor'
  targetId: number | null  // <-- НОВОЕ: ID конкретного получателя
  createdAt: number
}
```

Функции:
- `addActiveCall(call)` - сохраняет звонок при инициации
- `removeActiveCall(appointmentId)` - удаляет при завершении/отклонении
- `getActiveCallsForTarget(type, id)` - получает звонки для конкретного пользователя
- `hasActiveCall(appointmentId)` - проверяет наличие активного звонка

### 2. Получение targetId из базы данных

**Файл:** `src/lib/socket/handlers/callHandler.ts`

При инициации звонка (`call-initiate`):

```typescript
export function createCallHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: AuthenticatedSocket, data: CallSignalPayload) => {
    // Получаем appointment из БД
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      depth: 0,
    })
    
    // Извлекаем targetId
    if (socket.data.senderType === 'doctor') {
      // Врач звонит -> цель = пациент
      targetId = typeof appointment.user === 'number' 
        ? appointment.user 
        : appointment.user?.id ?? null
    } else {
      // Пациент звонит -> цель = врач
      targetId = typeof appointment.doctor === 'number' 
        ? appointment.doctor 
        : appointment.doctor?.id ?? null
    }
    
    // Сохраняем с targetId
    addActiveCall({ ...activeCall, targetId })
    
    // Отправляем только сокетам с senderId === targetId
    for (const [socketId, connectedSocket] of io.sockets.sockets) {
      const isTargetType = authSocket.data.senderType === targetType
      const isTargetId = targetId !== null 
        ? authSocket.data.senderId === targetId 
        : true
      
      if (isTargetType && isTargetId) {
        authSocket.emit('incoming-call', incomingCallPayload)
      }
    }
  }
}
```

### 3. Проверка pending calls при подключении

**Файл:** `src/lib/socket/handlers/callHandler.ts`

```typescript
export function checkPendingCallsForSocket(socket: AuthenticatedSocket): void {
  // Фильтруем по типу И конкретному ID пользователя
  const pendingCalls = getActiveCallsForTarget(
    socket.data.senderType, 
    socket.data.senderId  // <-- проверяем конкретного пользователя
  )
  
  for (const call of pendingCalls) {
    socket.emit('incoming-call', {
      appointmentId: call.appointmentId,
      callerPeerId: call.callerPeerId,
      callerName: call.callerName,
      callerType: call.callerType,
      callerId: call.callerId,
    })
  }
}
```

### 4. Вызов проверки при подключении сокета

**Файл:** `src/lib/socket/server.ts`

```typescript
io.on('connection', (socket) => {
  // ... аутентификация ...
  
  // Проверяем pending calls для этого пользователя
  checkPendingCallsForSocket(socket)
  
  // ... остальная логика ...
})
```

### 5. Передача Payload в callHandler

**Файл:** `src/lib/socket/server.ts`

```typescript
const callHandler = createCallHandler(io, payload)  // payload передается
```

## Результат

Теперь:
1. **Звонки хранятся** в `activeCallsStore` до завершения/отклонения
2. **targetId получается из БД** (appointment), а не из подключенных сокетов
3. **Звонки отправляются только конкретному получателю**, а не всем пользователям типа
4. **При подключении** пользователь получает все ожидающие его звонки
5. **При перезагрузке страницы** звонок не теряется - пользователь увидит его после переподключения

## Диаграмма исправленного процесса

```
Врач звонит                            Сервер                           Пациент
     │                                   │                                    │
     │ call-initiate                     │                                    │
     │ ─────────────────────────────────>│                                    │
     │                                   │                                    │
     │                                   │ 1. Получает appointment из БД      │
     │                                   │ 2. Извлекает targetId (userId)     │
     │                                   │ 3. Сохраняет в activeCallsStore    │
     │                                   │                                    │
     │                                   │ 4. Пациент НЕ подключен?           │
     │                                   │    Звонок сохранен, ждем...        │
     │                                   │                                    │
     │                                   │                    5. Пациент      │
     │                                   │ <───────────────────────────────── │
     │                                   │    подключается                    │
     │                                   │                                    │
     │                                   │ 6. checkPendingCallsForSocket()    │
     │                                   │    Ищет звонки для этого userId    │
     │                                   │                                    │
     │                                   │ 7. Нашли! Отправляем               │
     │                                   │ ─────────────────────────────────> │
     │                                   │    incoming-call                   │
     │                                   │                                    │
     │                                   │                    8. Пациент      │
     │                                   │                    видит звонок!   │
```
