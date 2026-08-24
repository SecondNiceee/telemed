'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, CameraOff, LogOut, MessageSquare, Mic, MicOff, PhoneOff, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCallRecorder } from '@/hooks/use-call-recorder'
import { useMediasoup } from '@/hooks/use-mediasoup'
import { useSpeakingDetector } from '@/hooks/use-speaking-detector'
import { useSocket } from '@/components/socket-provider'
import { useChatStore } from '@/stores/chat-store'
import { registerOpenCallRoom } from '@/lib/chat/call-chat-bridge'
import { cn } from '@/lib/utils'
import { CallChatPanel } from './call-chat-panel'

interface VideoSurfaceProps {
  stream: MediaStream | null
  muted?: boolean
  label: string
  audioOnly: boolean
  speakingEnabled?: boolean
  cameraOff?: boolean
  micMuted?: boolean
}

function VideoSurface({ stream, muted, label, audioOnly, speakingEnabled = true, cameraOff = false, micMuted = false }: VideoSurfaceProps) {
  const isSpeaking = useSpeakingDetector(stream, speakingEnabled && !micMuted)

  const attachStream = (node: HTMLVideoElement | HTMLAudioElement | null) => {
    if (node && node.srcObject !== stream) node.srcObject = stream
  }

  const hasLiveVideo = !audioOnly && !cameraOff && stream?.getVideoTracks().some((track) => track.readyState === 'live')

  return (
    <section className={cn('relative flex min-h-64 overflow-hidden rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200', isSpeaking && 'border-speaking ring-2 ring-speaking/70 ring-offset-2 ring-offset-background')}>
      {hasLiveVideo ? (
        <video ref={attachStream} autoPlay playsInline muted={muted} className="size-full object-cover" aria-label={label} />
      ) : (
        <div className="flex size-full min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          {audioOnly ? <Mic aria-hidden="true" /> : <CameraOff aria-hidden="true" />}
          <p className="text-sm">{audioOnly ? 'Аудиозвонок' : 'Камера выключена'}</p>
          {stream ? <audio ref={attachStream} autoPlay muted={muted} /> : null}
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground backdrop-blur">
        {isSpeaking ? <span className="size-2 rounded-full bg-speaking" aria-hidden="true" /> : null}
        {micMuted ? <MicOff className="size-4 text-destructive" aria-label="Микрофон выключен" /> : null}
        {label}
      </div>
    </section>
  )
}

interface CallRoomProps {
  appointmentId: number
  chatPath: '/lk/chat' | '/lk-med/chat'
  localParticipantName: string
  remoteParticipantName: string
  /** id врача, если звонок открыт врачом. Пациент получает null и не пишет. */
  recordingDoctorId: number | null
  /** Кто смотрит на эту страницу - нужно чату, чтобы отличать свои сообщения. */
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  /** Врач заблокировал чат пациенту (значение на момент загрузки страницы). */
  chatBlocked: boolean
}

export function CallRoom({
  appointmentId,
  chatPath,
  localParticipantName,
  remoteParticipantName,
  recordingDoctorId,
  currentSenderType,
  currentSenderId,
  chatBlocked,
}: CallRoomProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const audioOnly = searchParams.get('audio') === '1'
  const isCaller = searchParams.get('caller') === '1'
  const callId = searchParams.get('callId')
  const { outgoingCallStatuses, endCall: endCallSignal, getCallState, isConnected, joinRoom, leaveRoom } = useSocket()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const unreadCount = useChatStore((state) => state.unreadCounts[appointmentId] ?? 0)

  // Звонящий попадает сюда через router.push, поэтому у только что начатого
  // звонка статус приглашения в памяти всегда есть. Его отсутствие означает,
  // что страницу открыли заново по старой ссылке (например, после закрытия
  // браузера) - тогда ждать пациента нельзя, сначала надо выяснить, идёт ли
  // ещё звонок, иначе экран «Ждём пациента…» зависает навсегда.
  const knownStatus = callId ? outgoingCallStatuses[callId] : undefined
  const needsRestoreCheck = isCaller && Boolean(callId) && knownStatus === undefined
  const [restoredStatus, setRestoredStatus] = useState<'waiting' | 'answered' | 'closed' | null>(null)
  const [socketGraceElapsed, setSocketGraceElapsed] = useState(false)

  const invitationStatus: 'resolving' | 'waiting' | 'answered' | 'rejected' | 'closed' = !callId
    ? 'answered'
    : knownStatus ?? (needsRestoreCheck ? restoredStatus ?? 'resolving' : 'answered')

  const isCallActive = invitationStatus === 'answered'
  const isWaitingForPatient = invitationStatus === 'waiting'
  const isResolving = invitationStatus === 'resolving'
  const isRoomClosed = invitationStatus === 'closed'
  const call = useMediasoup(appointmentId, audioOnly)
  const connect = call.connect
  const handledEndReasonRef = useRef(false)
  const handledRejectionRef = useRef(false)
  const handledClosedRoomRef = useRef(false)
  const restoreCheckStartedRef = useRef(false)
  const recorder = useCallRecorder({
    enabled: recordingDoctorId !== null,
    appointmentId,
    doctorId: recordingDoctorId,
    localStream: call.localStream,
    remoteStream: call.remoteMedia?.stream ?? null,
    audioOnly,
  })
  const stopRecording = recorder.stop

  useEffect(() => {
    if (invitationStatus === 'answered') void connect()
  }, [connect, invitationStatus])

  // Сокет после перезагрузки поднимается не мгновенно. Ждём его недолго, но не
  // бесконечно: если связи нет, проверку всё равно нужно довести до конца.
  useEffect(() => {
    if (!needsRestoreCheck) return
    const timer = window.setTimeout(() => setSocketGraceElapsed(true), 5000)
    return () => window.clearTimeout(timer)
  }, [needsRestoreCheck])

  useEffect(() => {
    if (!needsRestoreCheck || !callId) return
    if (!isConnected && !socketGraceElapsed) return
    if (restoreCheckStartedRef.current) return
    restoreCheckStartedRef.current = true

    let cancelled = false
    void (async () => {
      // Сервер помнит только те приглашения, на которые ещё не ответили.
      const state = await getCallState(appointmentId, callId)
      if (cancelled) return
      if (state?.pending) {
        setRestoredStatus('waiting')
        return
      }

      // На приглашение ответили или оно истекло. Живой звонок отличаем от
      // закрытого по присутствию второго участника в комнате медиасервера.
      // Пары попыток достаточно: сервер считает только участников с живым
      // соединением, а собеседник мог принять звонок за мгновение до нашего
      // возвращения и ещё не успеть войти в комнату.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500))
        if (cancelled) return
        try {
          const response = await fetch('/api/mediasoup/room-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId }),
          })
          const data = await response.json() as { success?: boolean; otherPeerPresent?: boolean }
          if (cancelled) return
          if (!response.ok || data.success !== true) {
            // Состояние выяснить не удалось. Подключаемся: понятная ошибка
            // соединения лучше ложного «комната закрыта».
            setRestoredStatus('answered')
            return
          }
          if (data.otherPeerPresent) {
            setRestoredStatus('answered')
            return
          }
        } catch {
          if (!cancelled) setRestoredStatus('answered')
          return
        }
      }
      if (!cancelled) setRestoredStatus('closed')
    })()

    return () => {
      cancelled = true
    }
  }, [appointmentId, callId, getCallState, isConnected, needsRestoreCheck, socketGraceElapsed])

  useEffect(() => {
    if (!isRoomClosed || handledClosedRoomRef.current) return
    handledClosedRoomRef.current = true
    toast.info('Комната уже закрыта — звонок завершён', { position: 'top-center' })
    router.replace(`${chatPath}?appointment=${appointmentId}`)
  }, [appointmentId, chatPath, isRoomClosed, router])

  // В комнату чата входим на всё время звонка, даже когда панель закрыта:
  // иначе `new-message` не дойдёт и счётчик непрочитанных останется пустым.
  // isConnected в зависимостях - чтобы перезайти после реконнекта сокета.
  useEffect(() => {
    if (!isConnected) return
    joinRoom(appointmentId)
    return () => leaveRoom(appointmentId)
  }, [appointmentId, isConnected, joinRoom, leaveRoom])

  // Отмечаем, что комната открыта: пока мы здесь, глобальный тост о новом
  // сообщении по этой консультации не показывается. Его кнопка «Перейти» вела
  // на страницу чата через полную перезагрузку и выбрасывала из звонка.
  useEffect(() => {
    return registerOpenCallRoom(appointmentId)
  }, [appointmentId])

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
        ? `${remoteParticipantName} покинул(а) звонок`
        : `Соединение с ${remoteParticipantName} потеряно`,
      { position: 'top-center' },
    )
    // Сначала дописываем и финализируем запись, только потом уходим со
    // страницы: после размонтирования загрузка хвоста уже не гарантирована.
    void stopRecording().finally(() => router.replace(`${chatPath}?appointment=${appointmentId}`))
  }, [appointmentId, call.endReason, chatPath, remoteParticipantName, router, stopRecording])

  const leave = async () => {
    // Запись останавливаем до разрыва медиа: иначе треки уйдут из-под
    // MediaRecorder и хвост сегмента потеряется.
    await stopRecording()
    // Без установленного соединения нечего разрывать: достаточно снять
    // приглашение, если оно ещё висит на сервере.
    if (!isCallActive) {
      endCallSignal(appointmentId, callId ?? undefined)
      call.leave()
    } else {
      await call.endCall()
    }
    router.replace(`${chatPath}?appointment=${appointmentId}`)
  }

  return (
    <TooltipProvider>
      {/*
        На больших экранах высота фиксируется по вьюпорту: чат рядом с видео
        должен скроллиться внутри себя, а не растягивать страницу. На мобильных
        поведение прежнее (min-h-dvh), там чат открывается оверлеем.
      */}
      <main className="flex min-h-dvh flex-col bg-background p-4 text-foreground md:p-6 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary" aria-hidden="true" />
              <h1 className="text-balance text-xl font-semibold">Защищённая видеоконсультация</h1>
            </div>
            <p className="text-sm text-muted-foreground">Консультация №{appointmentId} · медиа передаётся через SFU</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {recorder.isRecording ? (
              <span className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 font-medium text-destructive" role="status" aria-live="polite">
                <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
                Идёт запись
              </span>
            ) : null}
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              {!call.online ? <WifiOff aria-hidden="true" /> : isResolving || (isCallActive && call.status === 'reconnecting') ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}
              <span>
                {isResolving
                  ? 'Проверяем звонок…'
                  : isRoomClosed
                    ? 'Комната закрыта'
                    : isWaitingForPatient
                      ? 'Ждём пациента…'
                      : !call.online
                        ? 'Нет сети'
                        : call.status === 'connected'
                          ? 'Соединение установлено'
                          : call.status === 'failed'
                            ? 'Ошибка соединения'
                            : 'Подключение…'}
              </span>
            </div>
          </div>
        </header>

        {call.error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <span>{call.error}</span>
            <Button variant="outline" size="sm" onClick={() => void call.connect()}><RefreshCw data-icon="inline-start" />Повторить</Button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {!isCallActive ? (
              <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm" role="status" aria-live="polite">
                {isRoomClosed ? (
                  <PhoneOff className="size-8 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <span className="size-3 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                )}
                <div className="flex flex-col gap-2">
                  <h2 className="text-balance text-2xl font-semibold">
                    {isRoomClosed ? 'Комната уже закрыта' : isResolving ? 'Проверяем состояние звонка…' : 'Ждём пациента…'}
                  </h2>
                  <p className="text-pretty text-sm leading-6 text-muted-foreground">
                    {isRoomClosed
                      ? 'Звонок завершён, участников в комнате нет. Открываем чат консультации.'
                      : isResolving
                        ? 'Выясняем, идёт ли ещё эта консультация.'
                        : 'Подключение к защищённой комнате начнётся после принятия звонка.'}
                  </p>
                </div>
                {isRoomClosed ? (
                  <Button variant="outline" onClick={() => router.replace(`${chatPath}?appointment=${appointmentId}`)}>Перейти в чат</Button>
                ) : null}
              </section>
            ) : (
              <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
                <VideoSurface stream={call.remoteMedia?.stream ?? null} label={call.remoteMedia ? remoteParticipantName : `Ожидаем: ${remoteParticipantName}`} audioOnly={audioOnly} cameraOff={!call.remoteCameraEnabled} micMuted={call.remoteMedia ? !call.remoteMicEnabled : false} />
                <VideoSurface stream={call.localStream} muted label={localParticipantName} audioOnly={audioOnly} speakingEnabled={call.micEnabled} cameraOff={!call.cameraEnabled} micMuted={!call.micEnabled} />
              </div>
            )}
          </div>

          {isChatOpen ? (
            <>
              {/* Затемнение только для мобильного оверлея: на десктопе чат стоит рядом. */}
              <div className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden" onClick={() => setIsChatOpen(false)} aria-hidden="true" />
              <div className="fixed inset-x-3 bottom-3 top-20 z-40 lg:static lg:inset-auto lg:z-auto lg:w-96 lg:shrink-0">
                <CallChatPanel
                  appointmentId={appointmentId}
                  currentSenderType={currentSenderType}
                  currentSenderId={currentSenderId}
                  otherPartyName={remoteParticipantName}
                  chatBlocked={chatBlocked}
                  onClose={() => setIsChatOpen(false)}
                />
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-3 pt-5">
          {isCallActive ? (
            <>
              <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.micEnabled ? 'secondary' : 'destructive'} onClick={() => void call.toggleMicrophone()} aria-label={call.micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}>{call.micEnabled ? <Mic /> : <MicOff />}</Button></TooltipTrigger><TooltipContent>{call.micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}</TooltipContent></Tooltip>
              {!audioOnly ? <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.cameraEnabled ? 'secondary' : 'destructive'} onClick={() => void call.toggleCamera()} aria-label={call.cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}>{call.cameraEnabled ? <Camera /> : <CameraOff />}</Button></TooltipTrigger><TooltipContent>{call.cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}</TooltipContent></Tooltip> : null}
            </>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-lg"
                variant={isChatOpen ? 'default' : 'secondary'}
                className="relative"
                onClick={() => setIsChatOpen((open) => !open)}
                aria-label={isChatOpen ? 'Скрыть чат' : 'Открыть чат консультации'}
                aria-expanded={isChatOpen}
              >
                <MessageSquare />
                {!isChatOpen && unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                    <span className="sr-only">непрочитанных сообщений</span>
                  </span>
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isChatOpen ? 'Скрыть чат' : 'Открыть чат консультации'}</TooltipContent>
          </Tooltip>
          <Button variant="destructive" size="lg" onClick={() => void leave()}><LogOut data-icon="inline-start" />Завершить</Button>
        </footer>
      </main>
    </TooltipProvider>
  )
}
