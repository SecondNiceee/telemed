'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, CameraOff, LogOut, Mic, MicOff, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediasoup } from '@/hooks/use-mediasoup'
import { useSpeakingDetector } from '@/hooks/use-speaking-detector'
import { useSocket } from '@/components/socket-provider'
import { cn } from '@/lib/utils'

function VideoSurface({ stream, muted, label, audioOnly, speakingEnabled = true }: { stream: MediaStream | null; muted?: boolean; label: string; audioOnly: boolean; speakingEnabled?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const isSpeaking = useSpeakingDetector(stream, speakingEnabled)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  const hasLiveVideo = !audioOnly && stream?.getVideoTracks().some((track) => track.enabled && track.readyState === 'live')

  return (
    <section className={cn('relative flex min-h-64 overflow-hidden rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200', isSpeaking && 'border-speaking ring-2 ring-speaking/70 ring-offset-2 ring-offset-background')}>
      {hasLiveVideo ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="size-full object-cover" aria-label={label} />
      ) : (
        <div className="flex size-full min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          {audioOnly ? <Mic aria-hidden="true" /> : <CameraOff aria-hidden="true" />}
          <p className="text-sm">{audioOnly ? 'Аудиозвонок' : 'Камера выключена'}</p>
          {stream ? <audio ref={(node) => { if (node) node.srcObject = stream }} autoPlay muted={muted} /> : null}
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground backdrop-blur">
        {isSpeaking ? <span className="size-2 rounded-full bg-speaking" aria-hidden="true" /> : null}
        {label}
      </div>
    </section>
  )
}

export function CallRoom({ appointmentId, chatPath }: { appointmentId: number; chatPath: '/lk/chat' | '/lk-med/chat' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const audioOnly = searchParams.get('audio') === '1'
  const isCaller = searchParams.get('caller') === '1'
  const callId = searchParams.get('callId')
  const { outgoingCallStatuses, endCall: endCallSignal } = useSocket()
  const invitationStatus = callId ? outgoingCallStatuses[callId] ?? (isCaller ? 'waiting' : 'answered') : 'answered'
  const isWaitingForPatient = isCaller && invitationStatus === 'waiting'
  const call = useMediasoup(appointmentId, audioOnly)
  const connect = call.connect
  const handledEndReasonRef = useRef(false)
  const handledRejectionRef = useRef(false)

  useEffect(() => {
    if (invitationStatus === 'answered') void connect()
  }, [connect, invitationStatus])

  useEffect(() => {
    if (!isCaller || invitationStatus !== 'rejected' || handledRejectionRef.current) return
    handledRejectionRef.current = true
    call.leave()
    toast.info('Пациент отклонил звонок', { position: 'top-center' })
    router.replace(`${chatPath}?appointment=${appointmentId}`)
  }, [appointmentId, call, chatPath, invitationStatus, isCaller, router])

  useEffect(() => {
    if (!call.endReason || handledEndReasonRef.current) return
    handledEndReasonRef.current = true
    toast.info(
      call.endReason === 'participant-ended'
        ? 'Собеседник покинул звонок'
        : 'Соединение с собеседником потеряно',
      { position: 'top-center' },
    )
    router.replace(`${chatPath}?appointment=${appointmentId}`)
  }, [appointmentId, call.endReason, chatPath, router])

  const leave = async () => {
    if (isWaitingForPatient) {
      endCallSignal(appointmentId, callId ?? undefined)
      call.leave()
    } else {
      await call.endCall()
    }
    router.replace(`${chatPath}?appointment=${appointmentId}`)
  }

  return (
    <TooltipProvider>
      <main className="flex min-h-dvh flex-col bg-background p-4 text-foreground md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary" aria-hidden="true" />
              <h1 className="text-balance text-xl font-semibold">Защищённая видеоконсультация</h1>
            </div>
            <p className="text-sm text-muted-foreground">Консультация №{appointmentId} · медиа передаётся через SFU</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {!call.online ? <WifiOff aria-hidden="true" /> : !isWaitingForPatient && call.status === 'reconnecting' ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}
            <span>{isWaitingForPatient ? 'Ждём пациента…' : !call.online ? 'Нет сети' : call.status === 'connected' ? 'Соединение установлено' : call.status === 'failed' ? 'Ошибка соединения' : 'Подключение…'}</span>
          </div>
        </header>

        {call.error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <span>{call.error}</span>
            <Button variant="outline" size="sm" onClick={() => void call.connect()}><RefreshCw data-icon="inline-start" />Повторить</Button>
          </div>
        ) : null}

        {isWaitingForPatient ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm" role="status" aria-live="polite">
            <span className="size-3 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <h2 className="text-balance text-2xl font-semibold">Ждём пациента…</h2>
              <p className="text-pretty text-sm leading-6 text-muted-foreground">Подключение к защищённой комнате начнётся после принятия звонка.</p>
            </div>
          </section>
        ) : (
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <VideoSurface stream={call.remoteMedia?.stream ?? null} label={call.remoteMedia ? 'Собеседник' : 'Ожидаем собеседника'} audioOnly={audioOnly} />
            <VideoSurface stream={call.localStream} muted label="Вы" audioOnly={audioOnly} speakingEnabled={call.micEnabled} />
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-center gap-3 pt-5">
          {!isWaitingForPatient ? (
            <>
              <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.micEnabled ? 'secondary' : 'destructive'} onClick={() => void call.toggleMicrophone()} aria-label={call.micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}>{call.micEnabled ? <Mic /> : <MicOff />}</Button></TooltipTrigger><TooltipContent>{call.micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}</TooltipContent></Tooltip>
              {!audioOnly ? <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.cameraEnabled ? 'secondary' : 'destructive'} onClick={() => void call.toggleCamera()} aria-label={call.cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}>{call.cameraEnabled ? <Camera /> : <CameraOff />}</Button></TooltipTrigger><TooltipContent>{call.cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}</TooltipContent></Tooltip> : null}
            </>
          ) : null}
          <Button variant="destructive" size="lg" onClick={() => void leave()}><LogOut data-icon="inline-start" />Завершить</Button>
        </footer>
      </main>
    </TooltipProvider>
  )
}
