export type OutgoingCallStatus = 'waiting' | 'answered' | 'rejected'

/**
 * Статусы исходящих приглашений живут вне состояния компонента.
 *
 * Начав звонок из чата, врач сразу уходит на /appointment/[id]/call: страница
 * чата размонтируется вместе со своим SocketProvider, а страница звонка читает
 * уже другой экземпляр провайдера. Пока статус лежал в useState, он исчезал
 * при этом переходе - комната звонка не знала, что звонок только что начат, и
 * запускала проверку «а не закрыт ли он», которая для ещё не отвеченного
 * приглашения заканчивалась «Комната уже закрыта».
 *
 * Модульный стор общий для всех провайдеров, поэтому статус переживает и
 * переход между страницами, и параллельно смонтированные провайдеры.
 */
let outgoingCallStatusesSnapshot: Record<string, OutgoingCallStatus> = {}
const outgoingCallStatusListeners = new Set<() => void>()

function notifyOutgoingCallStatusListeners() {
  outgoingCallStatusListeners.forEach((listener) => listener())
}

export function setOutgoingCallStatus(callId: string, status: OutgoingCallStatus) {
  if (outgoingCallStatusesSnapshot[callId] === status) return
  outgoingCallStatusesSnapshot = { ...outgoingCallStatusesSnapshot, [callId]: status }
  notifyOutgoingCallStatusListeners()
}

export function clearOutgoingCallStatus(callId: string) {
  if (!(callId in outgoingCallStatusesSnapshot)) return
  const next = { ...outgoingCallStatusesSnapshot }
  delete next[callId]
  outgoingCallStatusesSnapshot = next
  notifyOutgoingCallStatusListeners()
}

export function subscribeToOutgoingCallStatuses(listener: () => void) {
  outgoingCallStatusListeners.add(listener)
  return () => {
    outgoingCallStatusListeners.delete(listener)
  }
}

export function getOutgoingCallStatusesSnapshot() {
  return outgoingCallStatusesSnapshot
}
