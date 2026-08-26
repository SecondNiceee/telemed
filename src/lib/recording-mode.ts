/**
 * Единый переключатель способа записи консультаций.
 *
 * Записи всего две, и они взаимоисключающие:
 *
 *   'server' - PlainTransport + FFmpeg на mediasoup-сервере
 *              (src/lib/mediasoup/recorder.ts). Не трогает браузер врача:
 *              во время звонка идёт `-c copy` (почти бесплатно), тяжёлая
 *              склейка выполняется офлайн после звонка. Требует ffmpeg на
 *              сервере.
 *   'client' - MediaRecorder в браузере врача
 *              (src/hooks/use-call-recorder.ts). Ничего не требует от
 *              сервера, но занимает ~0.9 Мбит/с аплинка врача и ~20% ядра,
 *              то есть отбирает ресурсы у живого звонка.
 *   'off'    - запись не ведётся вообще.
 *
 * ПОЧЕМУ ОДНА ПЕРЕМЕННАЯ, А НЕ ДВЕ. Раньше стороны включались независимо
 * (RECORDING_SERVER_SIDE для сервера, отсутствие флага для клиента), и при
 * неаккуратной настройке на одну консультацию создавались ДВЕ записи, каждая
 * из которых перезаписывала appointment.recording. Здесь режим один и живёт
 * в одном месте, поэтому такое состояние недостижимо по построению.
 *
 * ПОЧЕМУ ПРЕФИКС NEXT_PUBLIC. Переменную должны читать оба процесса: браузер
 * врача (клиентская запись) и Node-процесс mediasoup (серверная). Только
 * NEXT_PUBLIC_* попадает в клиентский бандл; при этом mediasoup-server.ts
 * грузит `dotenv/config`, поэтому в нём та же переменная доступна обычным
 * process.env. Секрета здесь нет - это выбор способа записи, не credential.
 *
 * ВАЖНО: Next инлайнит NEXT_PUBLIC_* на этапе СБОРКИ. После смены значения
 * нужен пересборка/перезапуск `next build`, а не только рестарт mediasoup.
 */

export type RecordingMode = 'server' | 'client' | 'off'

/**
 * Режим по умолчанию, когда переменная не задана.
 *
 * Стоит 'server': серверная запись не конкурирует с живым звонком за аплинк
 * и CPU врача. Значение в коде (а не только в .env) специально - чтобы
 * поведение было предсказуемым на окружении без настроенных переменных.
 */
const DEFAULT_RECORDING_MODE: RecordingMode = 'server'

const VALID_MODES: readonly RecordingMode[] = ['server', 'client', 'off']

function parseRecordingMode(raw: string | undefined): RecordingMode {
  const value = raw?.trim().toLowerCase()
  if (!value) return DEFAULT_RECORDING_MODE
  if ((VALID_MODES as readonly string[]).includes(value)) return value as RecordingMode

  // Тихо падать в дефолт на опечатке нельзя: человек будет уверен, что
  // выставил режим, а получит другой. Поэтому громко предупреждаем.
  console.warn(
    `[RecordingMode] Unknown NEXT_PUBLIC_RECORDING_MODE="${raw}". ` +
      `Expected one of: ${VALID_MODES.join(' | ')}. Falling back to "${DEFAULT_RECORDING_MODE}".`,
  )
  return DEFAULT_RECORDING_MODE
}

/**
 * Обращение к process.env.NEXT_PUBLIC_RECORDING_MODE намеренно записано
 * ЛИТЕРАЛОМ: Next подставляет значение в клиентский бандл только при
 * статическом доступе. Динамический process.env[key] в браузере даст
 * undefined, и клиентская запись молча никогда бы не включилась.
 */
export const recordingMode: RecordingMode = parseRecordingMode(
  process.env.NEXT_PUBLIC_RECORDING_MODE,
)

/** Писать на mediasoup-сервере через FFmpeg. */
export const isServerRecordingEnabled = recordingMode === 'server'

/** Писать в браузере врача через MediaRecorder. */
export const isClientRecordingEnabled = recordingMode === 'client'
