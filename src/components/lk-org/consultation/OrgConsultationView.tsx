"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, User, RefreshCw, Video, MessageSquare, Clock, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { resolveImageUrl } from "@/lib/utils/image"
import { formatDate, getStatusLabel, getStatusColor } from "@/lib/utils/date"
import { DoctorsApi } from "@/lib/api/doctors"
import { MessageBubble } from "@/components/chat/message-bubble"
import { AudioPlayer } from "@/components/ui/audio-player"
import { VideoPlayer } from "@/components/ui/video-player"
import { CallRecordingsApi, type ApiCallRecording } from "@/lib/api/call-recordings"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"
import type { ApiMessage } from "@/lib/api/messages"
import type { Media } from "@/payload-types"

interface OrgConsultationViewProps {
  doctor: ApiDoctor
  appointment: ApiAppointment
  initialMessages: ApiMessage[]
  initialRecordings: ApiCallRecording[]
}

export function OrgConsultationView({
  doctor,
  appointment,
  initialMessages,
  initialRecordings,
}: OrgConsultationViewProps) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [recordings] = useState(initialRecordings)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filter recordings by type
  const videoRecordings = useMemo(() => 
    recordings.filter(r => !r.recordingType || r.recordingType === 'video'), 
    [recordings]
  )
  const audioRecordings = useMemo(() => 
    recordings.filter(r => r.recordingType === 'audio'), 
    [recordings]
  )

  const specialty = DoctorsApi.getSpecialty(doctor)
  
  const userName = typeof appointment.user === 'object' && appointment.user
    ? appointment.user.name || appointment.user.email
    : appointment.userName || 'Пациент'

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      router.refresh()
      // Re-fetch messages via API
      const response = await fetch(`/api/messages?where[appointment][equals]=${appointment.id}&sort=createdAt&limit=500&depth=1`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setMessages(data.docs || [])
      }
    } catch (error) {
      console.error('Failed to refresh messages:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [appointment.id, router])

  return (
    <div className="flex-1">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link
          href="/lk-org/consultations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к консультациям
        </Link>

        {/* Header with doctor and patient info */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0">
                {doctor.photo ? (
                  <img
                    src={resolveImageUrl((doctor.photo as Media).url)}
                    alt={doctor.name || "Врач"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {doctor.name || "Без имени"}
                </h1>
                <p className="text-sm text-muted-foreground">{specialty}</p>
              </div>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-full ${getStatusColor(appointment.status)}`}>
              {getStatusLabel(appointment.status)}
            </span>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Пациент</p>
                <p className="font-medium text-foreground">{userName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Дата и время</p>
                <p className="font-medium text-foreground">
                  {formatDate(appointment.date)} в {appointment.time}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for Chat and Recordings */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Чат
            </TabsTrigger>
            <TabsTrigger value="recordings" className="gap-2">
              <Video className="w-4 h-4" />
              Видеозаписи
            </TabsTrigger>
            <TabsTrigger value="audio-recordings" className="gap-2">
              <Mic className="w-4 h-4" />
              Аудиозаписи
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            {/* Refresh button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>

            {/* Chat messages */}
            <div className="rounded-xl border border-border bg-card min-h-[400px] max-h-[600px] overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Нет сообщений</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    В этой консультации пока нет сообщений
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => {
                    const senderType = message.sender?.relationTo === 'doctors' ? 'doctor' : 'user'
                    const isDoctor = senderType === 'doctor'
                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={isDoctor}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recordings">
            <div className="rounded-xl border border-border bg-card min-h-[400px] p-4">
              {videoRecordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <Video className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Пока что нет видеозаписей</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Записи видеоконсультаций будут отображаться здесь
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {videoRecordings.map((recording) => {
                    const videoUrl = CallRecordingsApi.getVideoUrl(recording)
                    const recordedDate = recording.recordedAt 
                      ? new Date(recording.recordedAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Неизвестно'
                    const durationMin = recording.durationSeconds 
                      ? Math.floor(recording.durationSeconds / 60)
                      : 0
                    const durationSec = recording.durationSeconds 
                      ? recording.durationSeconds % 60
                      : 0

                    return (
                      <div key={recording.id} className="space-y-3">
                        {/* Recording info */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{recordedDate}</span>
                          {recording.durationSeconds && recording.durationSeconds > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {durationMin}:{durationSec.toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        
                        {/* Video player */}
                        {videoUrl && (
                          <VideoPlayer
                            src={resolveImageUrl(videoUrl)}
                            title="Запись консультации"
                            onDownload={() => {
                              const link = document.createElement('a')
                              link.href = resolveImageUrl(videoUrl)
                              link.download = `recording-${recording.id}.webm`
                              link.click()
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audio-recordings">
            <div className="rounded-xl border border-border bg-card min-h-[400px] p-4">
              {audioRecordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <Mic className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Пока что нет аудиозаписей</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Записи аудиоконсультаций будут отображаться здесь
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {audioRecordings.map((recording) => {
                    const audioUrl = CallRecordingsApi.getVideoUrl(recording)
                    const recordedDate = recording.recordedAt 
                      ? new Date(recording.recordedAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Неизвестно'
                    const durationMin = recording.durationSeconds 
                      ? Math.floor(recording.durationSeconds / 60)
                      : 0
                    const durationSec = recording.durationSeconds 
                      ? recording.durationSeconds % 60
                      : 0

                    return (
                      <div key={recording.id} className="space-y-3">
                        {/* Recording info */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{recordedDate}</span>
                          {recording.durationSeconds && recording.durationSeconds > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {durationMin}:{durationSec.toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        
                        {/* Audio player */}
                        {audioUrl && (
                          <AudioPlayer
                            src={resolveImageUrl(audioUrl)}
                            title="Аудиозапись консультации"
                            onDownload={() => {
                              const link = document.createElement('a')
                              link.href = resolveImageUrl(audioUrl)
                              link.download = `recording-${recording.id}.webm`
                              link.click()
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
