/**
 * Проверка IP-адреса на попадание в CIDR-диапазон (IPv4 и IPv6).
 *
 * Нужна для уведомлений ЮKassa: они приходят на открытый эндпоинт без подписи,
 * поэтому единственная быстрая проверка отправителя — его IP из официального
 * списка. Отдельная сравнимая гарантия — перечитать платёж через API, это делает
 * сам обработчик.
 *
 * Реализация без зависимостей: адреса приводятся к массиву байт и сравниваются
 * префиксы, поэтому IPv4 и IPv6 обрабатываются одним кодом.
 */

/** IPv4 (`a.b.c.d`) в 4 байта или null, если это не IPv4. */
function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null

  const bytes: number[] = []

  for (const part of parts) {
    // Пустая строка, лидирующие нули и мусор вида '1e2' не должны проходить.
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (value > 255) return null
    bytes.push(value)
  }

  return bytes
}

/** IPv6 в 16 байт (с поддержкой `::` и хвостового IPv4) или null. */
function parseIPv6(ip: string): number[] | null {
  // Зона вида fe80::1%eth0 для сравнения диапазонов не нужна.
  const withoutZone = ip.split('%')[0]
  if (!withoutZone.includes(':')) return null

  const [head, tail, ...rest] = withoutZone.split('::')
  // '::' может встречаться в адресе только один раз.
  if (rest.length > 0) return null

  const expand = (chunk: string): number[] | null => {
    if (!chunk) return []
    const groups = chunk.split(':')
    const bytes: number[] = []

    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i]

      // Последняя группа может быть записана как IPv4 (::ffff:127.0.0.1).
      if (i === groups.length - 1 && group.includes('.')) {
        const v4 = parseIPv4(group)
        if (!v4) return null
        bytes.push(...v4)
        continue
      }

      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
      const value = parseInt(group, 16)
      bytes.push((value >> 8) & 0xff, value & 0xff)
    }

    return bytes
  }

  const headBytes = expand(head)
  if (!headBytes) return null

  if (tail === undefined) {
    return headBytes.length === 16 ? headBytes : null
  }

  const tailBytes = expand(tail)
  if (!tailBytes) return null

  const missing = 16 - headBytes.length - tailBytes.length
  if (missing < 0) return null

  return [...headBytes, ...new Array(missing).fill(0), ...tailBytes]
}

/** IP-адрес в массив байт (4 для IPv4, 16 для IPv6) или null. */
export function parseIp(ip: string): number[] | null {
  const trimmed = ip.trim()
  if (!trimmed) return null

  // IPv4, завёрнутый в IPv6 (::ffff:1.2.3.4) — так его отдаёт двойной стек.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed)
  if (mapped) return parseIPv4(mapped[1])

  return parseIPv4(trimmed) ?? parseIPv6(trimmed)
}

/**
 * Входит ли адрес в диапазон.
 * `cidr` — либо `1.2.3.0/24`, либо одиночный адрес (тогда сравнение точное).
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.trim().split('/')

  const ipBytes = parseIp(ip)
  const networkBytes = parseIp(network)

  if (!ipBytes || !networkBytes) return false
  // IPv4 и IPv6 между собой не сравниваем.
  if (ipBytes.length !== networkBytes.length) return false

  const maxPrefix = networkBytes.length * 8
  const prefix = prefixRaw === undefined ? maxPrefix : Number(prefixRaw)

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) return false

  const fullBytes = Math.floor(prefix / 8)

  for (let i = 0; i < fullBytes; i += 1) {
    if (ipBytes[i] !== networkBytes[i]) return false
  }

  const remainingBits = prefix % 8
  if (remainingBits === 0) return true

  // Маска для незавершённого байта: старшие remainingBits бит.
  const mask = 0xff << (8 - remainingBits) & 0xff
  return (ipBytes[fullBytes] & mask) === (networkBytes[fullBytes] & mask)
}

/** Входит ли адрес хотя бы в один из диапазонов. */
export function isIpInAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  return cidrs.some((cidr) => isIpInCidr(ip, cidr))
}
