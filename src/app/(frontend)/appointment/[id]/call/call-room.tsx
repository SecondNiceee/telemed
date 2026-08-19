'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Camera, CameraOff, LogOut, Mic, MicOff, MonitorUp, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediasoup } from '@/hooks/use-mediasoup'

function VideoSurface({ stream, muted, label }: { stream: MediaStream | null; muted?: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <section className="relative flex min-h-64 overflow-hidden rounded-2xl border bg-card shadow-sm">
      {stream?.getVideoTracks().some((track) => track.enabled && track.readyState === 'live') ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="size-full object-cover" aria-label={label} />
      ) : (
        <div className="flex size-full min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <CameraOff aria-hidden="true" />
          <p className="text-sm">Камера выключена</p>
          {stream ? <audio ref={(node) => { if (node) node.srcObject = stream }} autoPlay muted={muted} /> : null}
        </div>
      )}
      <div className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground backdrop-blur">
        {label}
      </div>
    </section>
  )
}

export function CallRoom({ appointmentId }: { appointmentId: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const audioOnly = searchParams.get('audio') === '1'
  const call = useMediasoup(appointmentId, audioOnly)
  const connect = call.connect

  useEffect(() => { void connect() }, [connect])

  const leave = () => {
    call.leave()
    router.push('/lk/chat?appointment=' + appointmentId)
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
            {!call.online ? <WifiOff aria-hidden="true" /> : call.status === 'reconnecting' ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}
            <span>{!call.online ? 'Нет сети' : call.status === 'connected' ? 'Соединение установлено' : call.status === 'failed' ? 'Ошибка соединения' : 'Подключение…'}</span>
          </div>
        </header>

        {call.error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <span>{call.error}</span>
            <Button variant="outline" size="sm" onClick={() => void call.connect()}><RefreshCw data-icon="inline-start" />Повторить</Button>
          </div>
        ) : null}

        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <VideoSurface stream={call.remoteMedia?.stream ?? null} label={call.remoteMedia ? 'Собеседник' : 'Ожидаем собеседника'} />
          <VideoSurface stream={call.localStream} muted label="Вы" />
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-3 pt-5">
          <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.micEnabled ? 'secondary' : 'destructive'} onClick={() => void call.toggleMicrophone()} aria-label={call.micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}>{call.micEnabled ? <Mic /> : <MicOff />}</Button></TooltipTrigger><TooltipContent>{call.micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.cameraEnabled ? 'secondary' : 'destructive'} onClick={() => void call.toggleCamera()} aria-label={call.cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}>{call.cameraEnabled ? <Camera /> : <CameraOff />}</Button></TooltipTrigger><TooltipContent>{call.cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="icon-lg" variant={call.screenSharing ? 'default' : 'secondary'} onClick={() => void call.toggleScreen()} aria-label="Демонстрация экрана"><MonitorUp /></Button></TooltipTrigger><TooltipContent>Демонстрация экрана</TooltipContent></Tooltip>
          <Button variant="destructive" size="lg" onClick={leave}><LogOut data-icon="inline-start" />Завершить</Button>
        </footer>
      </main>
    </TooltipProvider>
  )
}
