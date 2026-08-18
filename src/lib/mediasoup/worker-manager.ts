import * as mediasoup from 'mediasoup'
import type { Worker } from 'mediasoup/types'
import { numWorkers, RTC_MAX_PORT_VALUE, RTC_MIN_PORT_VALUE, workerSettings } from './config'

class WorkerManager {
  private workers: Worker[] = []
  private nextWorkerIndex = 0
  private initialized = false
  private closing = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    this.closing = false
    console.log(`[MediaSoup] Creating ${numWorkers} worker(s) with RTC ports ${RTC_MIN_PORT_VALUE}-${RTC_MAX_PORT_VALUE}`)

    for (let index = 0; index < numWorkers; index += 1) {
      this.workers.push(await this.createWorker(index))
    }

    this.initialized = true
    console.log(`[MediaSoup] ${this.workers.length} worker(s) created`)
  }

  private async createWorker(index: number): Promise<Worker> {
    const worker = await mediasoup.createWorker(workerSettings)

    worker.on('died', (error) => {
      console.error(`[MediaSoup] Worker ${index} died:`, error)
      this.workers = this.workers.filter((candidate) => candidate !== worker)

      if (this.closing) return
      setTimeout(() => {
        void this.createWorker(index)
          .then((replacement) => this.workers.push(replacement))
          .catch((restartError) => console.error(`[MediaSoup] Failed to restart worker ${index}:`, restartError))
      }, 2000)
    })

    console.log(`[MediaSoup] Worker ${index} created, PID: ${worker.pid}`)
    return worker
  }

  getNextWorker(): Worker {
    if (this.workers.length === 0) throw new Error('[MediaSoup] No workers available')

    const worker = this.workers[this.nextWorkerIndex % this.workers.length]
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length
    return worker
  }

  getAllWorkers(): Worker[] {
    return [...this.workers]
  }

  async close(): Promise<void> {
    if (this.closing) return
    this.closing = true

    for (const worker of this.workers) {
      if (!worker.closed) worker.close()
    }

    this.workers = []
    this.nextWorkerIndex = 0
    this.initialized = false
  }

  async getStats(): Promise<{
    workersCount: number
    resourceUsage: Array<{ pid: number; memory: number }>
  }> {
    const resourceUsage = await Promise.all(
      this.workers.map(async (worker) => ({
        pid: worker.pid,
        memory: (await worker.getResourceUsage()).ru_maxrss,
      })),
    )

    return { workersCount: this.workers.length, resourceUsage }
  }
}

export const workerManager = new WorkerManager()
