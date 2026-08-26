import type { Device, types } from 'mediasoup-client'
import type { Socket } from 'socket.io-client'
import { emitAck, type TokenData } from './signaling'

export interface TransportDeps {
  /**
   * Сокет и токен читаются В МОМЕНТ СБОЯ, а не при создании транспорта.
   *
   * Это намеренно геттеры, а не значения: restartIce срабатывает через минуты
   * после createWebRtcTransports, и к тому времени сессия может быть уже
   * пересобрана. Так поведение совпадает с прежним чтением рефов.
   */
  getSocket: () => Socket | null
  getToken: () => TokenData | null
  /** Транспорт доложил 'connected'. */
  onConnected: () => void
  /** ICE поднять не удалось - уходим в переподключение. */
  onRecovering: () => void
}

/**
 * Пересобирает ICE для одного транспорта.
 *
 * Экспортируется потому, что вызывается не только по 'connectionstatechange':
 * при возврате сети хук дёргает её сам, не дожидаясь таймаутов ICE.
 */
export async function restartTransportIce(transport: types.Transport, deps: TransportDeps) {
  const socket = deps.getSocket()
  const token = deps.getToken()
  if (!socket || !token) return
  try {
    const response = await emitAck<{ iceParameters: types.IceParameters }>(socket, 'restartIce', { roomId: token.roomId, transportId: transport.id })
    await transport.restartIce({ iceParameters: response.iceParameters })
  } catch {
    deps.onRecovering()
    socket.disconnect().connect()
  }
}

function wireTransport(transport: types.Transport, deps: TransportDeps) {
  transport.on('connectionstatechange', (state) => {
    if (state === 'connected') deps.onConnected()
    if (state === 'failed' || state === 'disconnected') void restartTransportIce(transport, deps)
  })
}

/**
 * Поднимает пару WebRTC-транспортов (отправка и приём) и подписывает их на
 * сигнализацию сервера.
 *
 * Возвращает транспорты вызывающему, а не пишет их в рефы: владение сессией
 * остаётся в useMediasoup, который сверяет id сокета между каждым await.
 */
export async function createWebRtcTransports(
  socket: Socket,
  token: TokenData,
  device: Device,
  deps: TransportDeps,
): Promise<{ send: types.Transport; recv: types.Transport }> {
  const sendData = await emitAck<{ transport: types.TransportOptions }>(socket, 'createWebRtcTransport', { roomId: token.roomId, direction: 'send' })
  const recvData = await emitAck<{ transport: types.TransportOptions }>(socket, 'createWebRtcTransport', { roomId: token.roomId, direction: 'recv' })
  const transportOptions = { iceServers: token.iceServers }
  const send = device.createSendTransport({ ...sendData.transport, ...transportOptions })
  const recv = device.createRecvTransport({ ...recvData.transport, ...transportOptions })

  send.on('connect', ({ dtlsParameters }, callback, errback) => {
    emitAck(socket, 'connectTransport', { roomId: token.roomId, transportId: send.id, dtlsParameters }).then(() => callback()).catch(errback)
  })
  recv.on('connect', ({ dtlsParameters }, callback, errback) => {
    emitAck(socket, 'connectTransport', { roomId: token.roomId, transportId: recv.id, dtlsParameters }).then(() => callback()).catch(errback)
  })
  send.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
    emitAck<{ producerId: string }>(socket, 'produce', { roomId: token.roomId, transportId: send.id, kind, rtpParameters, appData })
      .then(({ producerId }) => callback({ id: producerId })).catch(errback)
  })
  wireTransport(send, deps)
  wireTransport(recv, deps)

  return { send, recv }
}
