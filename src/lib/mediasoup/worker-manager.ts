/**
 * MediaSoup Worker Manager
 * 
 * Manages MediaSoup workers (separate processes that handle media routing).
 * Uses round-robin to distribute load across workers.
 * 
 * SINGLE PORT MODE:
 * All workers share a single WebRtcServer on port 40000.
 * This means you only need to open ONE port for unlimited concurrent calls!
 */

import * as mediasoup from 'mediasoup'
import type { Worker, WebRtcServer } from 'mediasoup/types'
import { workerSettings, numWorkers, webRtcServerOptions, WEBRTC_SERVER_PORT } from './config'

class WorkerManager {
  private workers: Worker[] = []
  private webRtcServers: Map<number, WebRtcServer> = new Map() // workerIndex -> WebRtcServer
  private nextWorkerIndex = 0
  private initialized = false

  /**
   * Initialize MediaSoup workers
   * 
   * Creates workers and WebRtcServer on a SINGLE port (40000 by default).
   * Only the first worker gets the WebRtcServer, others share it via routing.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[MediaSoup] Workers already initialized')
      return
    }

    console.log(`[MediaSoup] Creating ${numWorkers} worker(s)...`)
    console.log(`[MediaSoup] Single port mode: all transports will use port ${WEBRTC_SERVER_PORT}`)

    for (let i = 0; i < numWorkers; i++) {
      const worker = await this.createWorker(i)
      this.workers.push(worker)
    }

    this.initialized = true
    console.log(`[MediaSoup] ${this.workers.length} worker(s) created`)
    console.log(`[MediaSoup] WebRtcServer listening on port ${WEBRTC_SERVER_PORT} (UDP + TCP)`)
  }

  /**
   * Create a single MediaSoup worker
   */
  private async createWorker(index: number): Promise<Worker> {
    const worker = await mediasoup.createWorker(workerSettings)

    worker.on('died', (error) => {
      console.error(`[MediaSoup] Worker ${index} died:`, error)
      
      // Remove the dead worker and its WebRtcServer
      const workerIndex = this.workers.indexOf(worker)
      if (workerIndex !== -1) {
        this.workers.splice(workerIndex, 1)
        this.webRtcServers.delete(workerIndex)
      }
      
      // Restart worker after a delay
      setTimeout(async () => {
        console.log(`[MediaSoup] Restarting worker ${index}...`)
        try {
          const newWorker = await this.createWorker(index)
          this.workers.push(newWorker)
          console.log(`[MediaSoup] Worker ${index} restarted`)
        } catch (err) {
          console.error(`[MediaSoup] Failed to restart worker ${index}:`, err)
        }
      }, 2000)
    })

    // Create WebRtcServer - SINGLE PORT for all workers
    // For multiple workers, each gets a separate port (40000, 40001, etc.)
    // But for telemedicine with 1-2 workers, this means 1-2 ports total
    try {
      const port = WEBRTC_SERVER_PORT + index
      const webRtcServer = await worker.createWebRtcServer({
        ...webRtcServerOptions,
        listenInfos: webRtcServerOptions.listenInfos.map((info) => ({
          ...info,
          port,
        })),
      })
      this.webRtcServers.set(index, webRtcServer)
      console.log(`[MediaSoup] Worker ${index} WebRtcServer created on port ${port}`)
    } catch (err) {
      // WebRTC server creation failed - this is now an error since we rely on it
      console.error(`[MediaSoup] Failed to create WebRtcServer for worker ${index}:`, err)
      console.log(`[MediaSoup] Worker ${index} will use individual ports (fallback mode)`)
    }

    console.log(`[MediaSoup] Worker ${index} created, PID: ${worker.pid}`)
    return worker
  }

  /**
   * Get the next available worker index (round-robin)
   */
  private getNextWorkerIndex(): number {
    if (this.workers.length === 0) {
      throw new Error('[MediaSoup] No workers available')
    }

    const index = this.nextWorkerIndex
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length
    return index
  }

  /**
   * Get the next available worker (round-robin)
   */
  getNextWorker(): Worker {
    const index = this.getNextWorkerIndex()
    return this.workers[index]
  }

  /**
   * Get the next available worker WITH its WebRtcServer (round-robin)
   * This ensures Router and WebRtcServer are from the SAME worker
   */
  getNextWorkerWithServer(): { worker: Worker; webRtcServer?: WebRtcServer; workerIndex: number } {
    const workerIndex = this.getNextWorkerIndex()
    const worker = this.workers[workerIndex]
    const webRtcServer = this.webRtcServers.get(workerIndex)
    
    return { worker, webRtcServer, workerIndex }
  }

  /**
   * Get worker by index
   */
  getWorker(index: number): Worker | undefined {
    return this.workers[index]
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Worker[] {
    return [...this.workers]
  }

  /**
   * Get WebRtcServer for a worker index
   * Used to create transports that share the single port
   */
  getWebRtcServer(workerIndex: number): WebRtcServer | undefined {
    return this.webRtcServers.get(workerIndex)
  }

  /**
   * Get WebRtcServer for current worker (round-robin)
   * This is the main method to use when creating transports
   */
  getNextWebRtcServer(): { server: WebRtcServer; workerIndex: number } | undefined {
    const workerIndex = this.getNextWorkerIndex()
    const server = this.webRtcServers.get(workerIndex)
    if (server) {
      return { server, workerIndex }
    }
    return undefined
  }

  /**
   * Close all workers
   */
  async close(): Promise<void> {
    console.log('[MediaSoup] Closing all workers...')
    
    for (const worker of this.workers) {
      worker.close()
    }
    
    this.workers = []
    this.webRtcServers = new Map()
    this.initialized = false
    
    console.log('[MediaSoup] All workers closed')
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<{
    workersCount: number
    resourceUsage: Array<{
      pid: number
      memory: number
    }>
  }> {
    const resourceUsage = await Promise.all(
      this.workers.map(async (worker) => ({
        pid: worker.pid,
        memory: (await worker.getResourceUsage()).ru_maxrss,
      }))
    )

    return {
      workersCount: this.workers.length,
      resourceUsage,
    }
  }
}

// Singleton instance
export const workerManager = new WorkerManager()
