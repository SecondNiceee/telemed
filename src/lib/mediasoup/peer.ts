import type { Consumer, Producer, RtpCapabilities, Transport } from 'mediasoup/types'

export type PeerRole = 'doctor' | 'patient'

export class Peer {
  readonly transports = new Map<string, Transport>()
  readonly transportDirections = new Map<string, 'send' | 'recv'>()
  readonly producers = new Map<string, Producer>()
  readonly consumers = new Map<string, Consumer>()
  rtpCapabilities?: RtpCapabilities
  private closed = false
  /**
   * Момент, когда сокет участника отключился. Участник остаётся в комнате ещё
   * несколько секунд (льготный период на переподключение), поэтому наличие
   * записи в room.peers не означает, что человек на самом деле в звонке.
   */
  private disconnectedAt: number | null = null

  constructor(
    readonly id: string,
    readonly name: string,
    readonly role: PeerRole,
  ) {}

  get isClosed(): boolean {
    return this.closed
  }

  /** Есть ли у участника живое соединение с сервером. */
  get isOnline(): boolean {
    return !this.closed && this.disconnectedAt === null
  }

  markDisconnected(): void {
    if (this.disconnectedAt === null) this.disconnectedAt = Date.now()
  }

  markConnected(): void {
    this.disconnectedAt = null
  }

  replaceTransport(transport: Transport, direction: 'send' | 'recv'): void {
    this.assertOpen()
    for (const [transportId, currentDirection] of this.transportDirections) {
      if (currentDirection !== direction) continue
      const current = this.transports.get(transportId)
      if (current && !current.closed) current.close()
      this.transports.delete(transportId)
      this.transportDirections.delete(transportId)
    }
    this.transports.set(transport.id, transport)
    this.transportDirections.set(transport.id, direction)
  }

  getTransport(transportId: string, direction?: 'send' | 'recv'): Transport | undefined {
    const transport = this.transports.get(transportId)
    if (!transport || (direction && this.transportDirections.get(transportId) !== direction)) return undefined
    return transport
  }

  ownsProducer(producerId: string): boolean {
    return this.producers.has(producerId)
  }

  close(): void {
    if (this.closed) return
    this.closed = true

    for (const consumer of this.consumers.values()) if (!consumer.closed) consumer.close()
    for (const producer of this.producers.values()) if (!producer.closed) producer.close()
    for (const transport of this.transports.values()) if (!transport.closed) transport.close()

    this.consumers.clear()
    this.producers.clear()
    this.transports.clear()
    this.transportDirections.clear()
  }

  private assertOpen(): void {
    if (this.closed) throw new Error(`Peer ${this.id} is closed`)
  }
}
