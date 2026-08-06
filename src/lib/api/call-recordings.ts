import { serverApiFetch } from './fetch'
import type { PayloadListResponse } from './types'
import type { Media } from '@/payload-types'

export interface ApiCallRecording {
  id: number
  appointment: number | { id: number }
  doctor: number | { id: number; name?: string }
  recordingType?: 'video' | 'audio'
  video: number | Media
  durationSeconds?: number
  recordedAt?: string
  createdAt: string
  updatedAt: string
}

export class CallRecordingsApi {
  /**
   * Fetch recordings for a specific appointment (server-side)
   */
  static async fetchByAppointmentServer(
    appointmentId: number,
    options: { cookie?: string } = {}
  ): Promise<ApiCallRecording[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiCallRecording>>(
      `/api/call-recordings?where[appointment][equals]=${appointmentId}&depth=1&sort=-createdAt`,
      { ...options, cache: 'no-store' }
    )
    return data.docs
  }

  /**
   * Fetch recordings for a specific doctor (server-side)
   */
  static async fetchByDoctorServer(
    doctorId: number,
    options: { cookie?: string } = {}
  ): Promise<ApiCallRecording[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiCallRecording>>(
      `/api/call-recordings?where[doctor][equals]=${doctorId}&depth=1&sort=-createdAt&limit=100`,
      { ...options, cache: 'no-store' }
    )
    return data.docs
  }

  /**
   * Get video URL from a recording
   */
  static getVideoUrl(recording: ApiCallRecording): string | null {
    if (typeof recording.video === 'object' && recording.video?.url) {
      return recording.video.url
    }
    return null
  }
}
