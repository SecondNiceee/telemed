/**
 * Оценка качества связи по сырой статистике WebRTC.
 *
 * Модуль намеренно чистый (без React и без сокета): те же функции считают
 * показатели в браузере и форматируют их в лог на сервере, поэтому клиент и
 * сервер не могут разойтись в трактовке одних и тех же цифр.
 */

/** Как часто снимаем статистику с транспортов. */
export const QUALITY_POLL_MS = 4_000

/**
 * Как часто отчёт уходит на сервер при неизменном уровне. Смена уровня едет
 * сразу - интервал нужен лишь для того, чтобы «всё хорошо» не превращалось в
 * поток одинаковых сообщений.
 */
export const QUALITY_REPORT_INTERVAL_MS = 30_000

/**
 * Порог, ниже которого доля потерь не считается. На горстке пакетов один
 * потерянный даёт десятки процентов и ложную «плохую связь».
 */
const MIN_PACKETS_FOR_LOSS = 20

const FAIR_LOSS_PCT = 2
const POOR_LOSS_PCT = 5
const FAIR_RTT_MS = 200
const POOR_RTT_MS = 400

export type CallQualityLevel = 'unknown' | 'good' | 'fair' | 'poor'

export interface CallQualitySnapshot {
  level: CallQualityLevel
  /** Круговая задержка до SFU, мс. null - браузер не дал ни одной пары кандидатов. */
  rttMs: number | null
  /** Доля потерь за последний интервал, %. null - пакетов слишком мало для оценки. */
  outboundLossPct: number | null
  inboundLossPct: number | null
  outboundKbps: number | null
  inboundKbps: number | null
  jitterMs: number | null
}

export const UNKNOWN_QUALITY: CallQualitySnapshot = {
  level: 'unknown',
  rttMs: null,
  outboundLossPct: null,
  inboundLossPct: null,
  outboundKbps: null,
  inboundKbps: null,
  jitterMs: null,
}

/**
 * Накопительные счётчики на момент съёма. Сами по себе бесполезны: WebRTC
 * отдаёт их с начала сессии, поэтому проценты и битрейт считаются только по
 * разнице двух снимков.
 */
export interface QualityCounters {
  at: number
  outboundPackets: number
  outboundLost: number
  outboundBytes: number
  inboundPackets: number
  inboundLost: number
  inboundBytes: number
  /** Мгновенные величины, разница для них не нужна. */
  jitterMs: number | null
  rttMs: number | null
}

/** Поля статистики, которые нас интересуют. Браузеры дают их не все. */
interface RawStat {
  type?: string
  packetsSent?: number
  bytesSent?: number
  packetsReceived?: number
  bytesReceived?: number
  packetsLost?: number
  jitter?: number
  roundTripTime?: number
  currentRoundTripTime?: number
  nominated?: boolean
  state?: string
}

function toNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Складывает статистику отправляющего и принимающего транспортов в один набор
 * счётчиков.
 *
 * Потери на отправке нельзя взять из локальных отчётов: сколько наших пакетов
 * не дошло, знает только принимающая сторона, и она сообщает это в
 * `remote-inbound-rtp`. Поэтому отправленные пакеты берутся из `outbound-rtp`,
 * а потерянные - из встречного отчёта.
 */
export function readQualityCounters(reports: RTCStatsReport[]): QualityCounters {
  const counters: QualityCounters = {
    at: Date.now(),
    outboundPackets: 0,
    outboundLost: 0,
    outboundBytes: 0,
    inboundPackets: 0,
    inboundLost: 0,
    inboundBytes: 0,
    jitterMs: null,
    rttMs: null,
  }

  let candidatePairRttMs: number | null = null
  let remoteInboundRttMs: number | null = null
  let jitterMs: number | null = null

  for (const report of reports) {
    report.forEach((entry) => {
      const stat = entry as RawStat
      switch (stat.type) {
        case 'outbound-rtp':
          counters.outboundPackets += toNumber(stat.packetsSent)
          counters.outboundBytes += toNumber(stat.bytesSent)
          break
        case 'remote-inbound-rtp':
          counters.outboundLost += toNumber(stat.packetsLost)
          if (typeof stat.roundTripTime === 'number') {
            remoteInboundRttMs = Math.max(remoteInboundRttMs ?? 0, stat.roundTripTime * 1000)
          }
          break
        case 'inbound-rtp':
          counters.inboundPackets += toNumber(stat.packetsReceived)
          counters.inboundLost += toNumber(stat.packetsLost)
          counters.inboundBytes += toNumber(stat.bytesReceived)
          // Из нескольких дорожек берём худшую: именно она портит впечатление.
          if (typeof stat.jitter === 'number') {
            jitterMs = Math.max(jitterMs ?? 0, stat.jitter * 1000)
          }
          break
        case 'candidate-pair':
          // Успешной пары может не быть вовсе, а неактивные держат устаревшие
          // значения - берём только ту, по которой реально идёт трафик.
          if ((stat.nominated === true || stat.state === 'succeeded') && typeof stat.currentRoundTripTime === 'number') {
            candidatePairRttMs = Math.max(candidatePairRttMs ?? 0, stat.currentRoundTripTime * 1000)
          }
          break
        default:
          break
      }
    })
  }

  // Пара кандидатов измеряет задержку самого канала до SFU и обновляется чаще,
  // чем RTCP-отчёты, поэтому она в приоритете.
  counters.rttMs = candidatePairRttMs ?? remoteInboundRttMs
  counters.jitterMs = jitterMs
  return counters
}

function lossPct(lostDelta: number, packetsDelta: number): number | null {
  const total = lostDelta + packetsDelta
  if (total < MIN_PACKETS_FOR_LOSS) return null
  // Переупорядочивание пакетов даёт отрицательный прирост потерь.
  return Math.max(0, (lostDelta / total) * 100)
}

function kbps(bytesDelta: number, seconds: number): number | null {
  if (seconds <= 0) return null
  return Math.max(0, (bytesDelta * 8) / 1000 / seconds)
}

function classify(rttMs: number | null, outboundLossPct: number | null, inboundLossPct: number | null): CallQualityLevel {
  if (rttMs === null && outboundLossPct === null && inboundLossPct === null) return 'unknown'

  const loss = Math.max(outboundLossPct ?? 0, inboundLossPct ?? 0)
  if (loss > POOR_LOSS_PCT || (rttMs !== null && rttMs > POOR_RTT_MS)) return 'poor'
  if (loss > FAIR_LOSS_PCT || (rttMs !== null && rttMs > FAIR_RTT_MS)) return 'fair'
  return 'good'
}

/** Считает показатели за интервал между двумя снимками счётчиков. */
export function summarizeQuality(prev: QualityCounters, next: QualityCounters): CallQualitySnapshot {
  const seconds = (next.at - prev.at) / 1000
  const outboundLossPct = lossPct(next.outboundLost - prev.outboundLost, next.outboundPackets - prev.outboundPackets)
  const inboundLossPct = lossPct(next.inboundLost - prev.inboundLost, next.inboundPackets - prev.inboundPackets)

  return {
    level: classify(next.rttMs, outboundLossPct, inboundLossPct),
    rttMs: next.rttMs,
    outboundLossPct,
    inboundLossPct,
    outboundKbps: kbps(next.outboundBytes - prev.outboundBytes, seconds),
    inboundKbps: kbps(next.inboundBytes - prev.inboundBytes, seconds),
    jitterMs: next.jitterMs,
  }
}

export function describeQualityLevel(level: CallQualityLevel): string {
  switch (level) {
    case 'good':
      return 'Связь стабильна'
    case 'fair':
      return 'Связь нестабильна'
    case 'poor':
      return 'Плохая связь'
    default:
      return 'Оцениваем связь'
  }
}

/** Одна строка для серверного лога: показатели в фиксированном порядке. */
export function formatQualityLogFields(snapshot: CallQualitySnapshot): string {
  const num = (value: number | null, digits = 0) => (value === null ? '-' : value.toFixed(digits))
  return [
    `level=${snapshot.level}`,
    `rtt=${num(snapshot.rttMs)}ms`,
    `loss_out=${num(snapshot.outboundLossPct, 1)}%`,
    `loss_in=${num(snapshot.inboundLossPct, 1)}%`,
    `kbps_out=${num(snapshot.outboundKbps)}`,
    `kbps_in=${num(snapshot.inboundKbps)}`,
    `jitter=${num(snapshot.jitterMs)}ms`,
  ].join(' ')
}
