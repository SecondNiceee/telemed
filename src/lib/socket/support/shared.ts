import type { Payload } from 'payload'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { SupportConversation, SupportMessage } from '@/payload-types'
import getCookieValue from '../utils/getCookieValue'
import verifyToken from '../utils/verifyToken'

/** Namespace для анонимных посетителей — отдельный от основного. */
export const SUPPORT_NAMESPACE = '/support'

/**
 * Комната операторов.
 *
 * Все админские вкладки сидят в ней, чтобы новое обращение прилетало сразу
 * во все открытые инбоксы, а не только в ту вкладку, что «повезло».
 */
export const OPERATORS_ROOM = 'support:operators'

/** Сколько последних сообщений отдаём при возврате на сайт. */
export const HISTORY_LIMIT = 50

/** Сколько диалогов отдаём в инбокс за раз. */
export const INBOX_LIMIT = 100

export interface SupportMessageDto {
  id: number
  sender: 'visitor' | 'operator'
  text: string
  createdAt: string
}

export interface SupportAck {
  success: boolean
  error?: string
  publicId?: string
  messages?: SupportMessageDto[]
}

/**
 * Диалог в списке инбокса.
 *
 * Числовой id коллекции наружу не отдаём даже админу — оператор работает по
 * тому же publicId, что и посетитель. Один идентификатор на всю фичу проще
 * держать в голове, а лишних способов адресовать диалог не появляется.
 */
export interface SupportConversationDto {
  publicId: string
  /** Техническая метка «Посетитель #xxxx» — настоящее имя не собирается. */
  visitorName: string
  status: 'open' | 'closed'
  lastMessageAt: string | null
  operatorReadAt: string | null
  pageUrl: string | null
  createdAt: string
  /** Последнее сообщение — превью в списке, чтобы не грузить всю переписку. */
  lastMessagePreview: string | null
  lastMessageSender: 'visitor' | 'operator' | null
}

export interface SupportOperatorAck {
  success: boolean
  error?: string
  conversations?: SupportConversationDto[]
  messages?: SupportMessageDto[]
  conversation?: SupportConversationDto
}

export function toDto(message: SupportMessage): SupportMessageDto {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt,
  }
}

export function roomName(publicId: string): string {
  return `support:${publicId}`
}

/**
 * Отдельный rate limit для поддержки.
 *
 * Общий `isRateLimited` берёт лимит из глобальной константы (10 сообщений в
 * секунду) — для авторизованного чата это разумно, но анонимной поддержке
 * нужен свой, более строгий счётчик. Своя карта ещё и изолирует поддержку:
 * флуд в виджете не съест лимит консультаций.
 */
const supportLimits = new Map<string, { count: number; resetAt: number }>()

const SUPPORT_LIMIT_MAX = 5
const SUPPORT_LIMIT_WINDOW_MS = 10_000

export function isSupportRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = supportLimits.get(key)

  if (!entry || now > entry.resetAt) {
    supportLimits.set(key, { count: 1, resetAt: now + SUPPORT_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= SUPPORT_LIMIT_MAX) return true

  entry.count++
  return false
}

/** Периодическая уборка, чтобы карта не росла бесконечно. */
export function cleanupSupportLimits(): void {
  const now = Date.now()
  for (const [key, entry] of supportLimits.entries()) {
    if (now > entry.resetAt) supportLimits.delete(key)
  }
}

/** Найти диалог по публичному идентификатору. */
export async function findConversation(
  payload: Payload,
  publicId: unknown,
): Promise<SupportConversation | null> {
  if (typeof publicId !== 'string' || publicId.length < 16) return null

  const result = await payload.find({
    collection: 'support-conversations',
    where: { publicId: { equals: publicId } },
    limit: 1,
    depth: 0,
  })

  return result.docs[0] ?? null
}

/**
 * Разослать сообщение всем открытым вкладкам посетителя.
 *
 * Живёт здесь, а не в мосте Telegram, потому что вызывается с двух сторон:
 * и когда пишет посетитель, и когда отвечает оператор.
 */
export function emitToVisitor(
  io: SocketIOServer,
  publicId: string,
  message: SupportMessageDto,
): void {
  io.of(SUPPORT_NAMESPACE).to(roomName(publicId)).emit('support:message', message)
}

/**
 * Уведомить операторов о движении в диалоге.
 *
 * Летит и на новое обращение, и на очередное сообщение: инбокс по одному
 * событию и поднимает диалог наверх списка, и звонит. Отдаём диалог целиком,
 * чтобы клиенту не пришлось догружать его отдельным запросом.
 */
export function emitToOperators(
  io: SocketIOServer,
  conversation: SupportConversationDto,
  message: SupportMessageDto,
): void {
  io.of(SUPPORT_NAMESPACE)
    .to(OPERATORS_ROOM)
    .emit('support:operator:incoming', { conversation, message })
}

/**
 * Обновить диалог в открытых инбоксах, не привлекая внимания.
 *
 * Отличается от `emitToOperators` тем, что не должно звонить: это ответ самого
 * оператора или снятая отметка «непрочитано». Разные события вместо одного с
 * флагом — чтобы клиент не решал «звонить или нет» по данным.
 */
export function emitOperatorSync(
  io: SocketIOServer,
  conversation: SupportConversationDto,
  message?: SupportMessageDto,
): void {
  io.of(SUPPORT_NAMESPACE)
    .to(OPERATORS_ROOM)
    .emit('support:operator:sync', { conversation, message })
}

/** Диалог в форме, пригодной для инбокса. */
export function toConversationDto(
  conversation: SupportConversation,
  lastMessage?: SupportMessage | null,
): SupportConversationDto {
  return {
    publicId: conversation.publicId,
    visitorName: conversation.visitorName,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt ?? null,
    operatorReadAt: conversation.operatorReadAt ?? null,
    pageUrl: conversation.pageUrl ?? null,
    createdAt: conversation.createdAt,
    // Превью обрезаем: в списке всё равно одна строка, а гонять полный текст
    // всех диалогов незачем.
    lastMessagePreview: lastMessage ? lastMessage.text.slice(0, 160) : null,
    lastMessageSender: lastMessage ? lastMessage.sender : null,
  }
}

/**
 * Проверка, что за сокетом действительно администратор.
 *
 * Namespace `/support` гостевой — middleware личность не проверяет, потому что
 * посетители анонимны. Значит операторские события обязаны проверять доступ
 * сами, на каждый вызов.
 *
 * Роль читаем из БД, а не из claim'ов токена: `role` в JWT не сохраняется
 * (`saveToJWT` у поля не выставлен), а даже если бы сохранялся — понижение
 * роли в админке не должно ждать истечения старого токена.
 */
export async function authenticateOperator(
  payload: Payload,
  socket: Socket,
): Promise<{ id: number | string; name: string | null } | null> {
  const token = getCookieValue(socket.handshake.headers.cookie || '', 'payload-token')
  if (!token) return null

  // Подпись здесь проверяется по-настоящему (jwt.verify), иначе подделанная
  // cookie открыла бы чужую переписку с контактами людей.
  const decoded = verifyToken(token)
  if (!decoded?.id) return null

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.id,
      depth: 0,
      overrideAccess: true,
    })
    if (!user || user.role !== 'admin') return null
    return { id: user.id, name: user.name ?? null }
  } catch {
    return null
  }
}

/**
 * Метка посетителя для оператора: «Посетитель #a1b2».
 *
 * Хвост publicId, а не голова: голова у всех hex-строк визуально похожа,
 * а полный идентификатор — токен доступа к переписке, его светить в названии
 * темы Telegram нельзя. Четыре символа дают 65 536 вариантов — для различения
 * диалогов в инбоксе достаточно, а по коллизии всё равно ничего не откроешь.
 */
export function visitorLabel(publicId: string): string {
  return `Посетитель #${publicId.slice(-4)}`
}
