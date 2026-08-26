/**
 * Пул RTP-портов для записи.
 *
 * Это класс, а не набор функций: занятые порты - живое состояние, которое
 * должно быть общим на всё приложение и не может лежать в модульной переменной,
 * иначе его нельзя ни сбросить в тестах, ни изолировать.
 */

import type { RecordingSession } from './types'

const PORT_RANGE_START = 5000
const PORT_RANGE_END = 5998

export class PortPool {
  private readonly usedPorts = new Set<number>()

  /** Allocate an even RTP port + odd RTCP port pair, tracking usage. */
  allocatePair(): { rtpPort: number; rtcpPort: number } {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 2) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        return { rtpPort: port, rtcpPort: port + 1 }
      }
    }
    throw new Error('No free RTP ports for recording')
  }

  /** Освободить один порт - нужно при неудачном создании входа. */
  release(rtpPort: number): void {
    this.usedPorts.delete(rtpPort)
  }

  releaseSession(session: RecordingSession): void {
    for (const input of session.inputs) this.usedPorts.delete(input.rtpPort)
  }
}
