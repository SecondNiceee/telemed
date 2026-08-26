/**
 * Сборка SDP и аргументов FFmpeg. Чистые функции: ничего не запускают и не
 * держат состояния, поэтому их поведение целиком определяется входом.
 *
 * КАЖДЫЙ КОММЕНТАРИЙ ЗДЕСЬ - ЗАФИКСИРОВАННЫЙ БАГ. Флаги -flush_packets, -live,
 * сырой PCM, -analyzeduration 0 и отсутствие first_pts=0 объясняют, почему
 * пропадал звук, обрывались файлы и чернела половина канваса. Прежде чем менять
 * любой из них, прочитайте соответствующий комментарий.
 */

import { recordingConfig } from '../config'
import { CANVAS_H, CANVAS_W, OUTPUT_FPS, PANE_H, PANE_W } from './layout'
import { computeOffsets } from './media-clock'
import type { RecordingInput, RecordingSession } from './types'

/**
 * SDP ровно с ОДНОЙ m=-секцией. Это ключ к новой схеме: у процесса FFmpeg
 * нет второго потока, с которым надо что-то синхронизировать.
 */
export function generateSdp(input: RecordingInput): string {
  const codec = input.consumer.rtpParameters.codecs[0]
  const payloadType = codec.payloadType
  const codecName = codec.mimeType.split('/')[1]

  const lines = ['v=0', 'o=- 0 0 IN IP4 127.0.0.1', 's=MediaSoup Recording', 'c=IN IP4 127.0.0.1', 't=0 0']

  if (input.kind === 'video') {
    lines.push(`m=video ${input.rtpPort} RTP/AVP ${payloadType}`)
    lines.push(`a=rtpmap:${payloadType} ${codecName}/${codec.clockRate}`)
  } else {
    lines.push(`m=audio ${input.rtpPort} RTP/AVP ${payloadType}`)
    lines.push(`a=rtpmap:${payloadType} ${codecName}/${codec.clockRate}/${codec.channels || 2}`)
  }

  const fmtp = Object.entries(codec.parameters ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
  if (fmtp) lines.push(`a=fmtp:${payloadType} ${fmtp}`)
  lines.push(`a=rtcp:${input.rtcpPort}`)
  lines.push('a=recvonly')

  return lines.join('\r\n') + '\r\n'
}

/**
 * ЭТАП 1: приём одного потока и запись в файл без перекодирования.
 *
 * -use_wallclock_as_timestamps ставит метки по времени прихода пакетов. Для
 * ОДНОГО потока это идеально: метки монотонны, длительность файла равна
 * реальному времени, и никакие RTP-таймстампы уже ничего не портят.
 * Без -nostdin: остановка идёт командой "q" через stdin - только так FFmpeg
 * гарантированно финализирует контейнер.
 */
export function buildInputFfmpegArgs(input: RecordingInput): string[] {
  const isAudio = input.kind === 'audio'

  return [
    '-loglevel', 'warning',
    '-protocol_whitelist', 'file,rtp,udp',

    // Анализ входа для аудио отключён - см. ниже про пустые файлы.
    //
    // Факт из логов: процессы a-audio/b-audio жили все 53 секунды, но файлы
    // остались настолько пустыми, что hasUsableData их отбросил
    // ("Skipping empty tracks: a-audio, b-audio"), и в склейку не попало
    // -map '[a]'. При этом в stderr по аудио не было НИ ОДНОГО сообщения,
    // тогда как видео исправно писало "max delay reached".
    //
    // Пустой файл при живом процессе означает, что дело было до/на записи
    // заголовка: FFmpeg пишет заголовок только ПОСЛЕ
    // avformat_find_stream_info(), а для аудио анализ требует РАСКОДИРОВАТЬ
    // пакет, чтобы узнать sample_fmt. Кодек, частоту и каналы мы и так
    // знаем из SDP, поэтому анализ здесь - чистый риск без пользы: с
    // analyzeduration 0 заголовок пишется сразу.
    //
    // Для видео лимиты не трогаем: оно писалось исправно, и менять то, что
    // работает, смысла нет.
    '-analyzeduration', isAudio ? '0' : '5M',
    '-probesize', isAudio ? '32' : '5M',

    '-buffer_size', '8388608',
    '-max_delay', '1000000',
    '-reorder_queue_size', '2048',
    '-thread_queue_size', '8192',

    // Ставится и аудио, и видео - НЕ РАЗДЕЛЯТЬ.
    //
    // Была попытка оставить аудио родные RTP-таймстампы (они сэмпл-точные),
    // чтобы убрать уплыв звука. Так делать нельзя: чтобы перевести
    // RTP-таймстамп в реальное время, FFmpeg должен получить RTCP Sender
    // Report, а здесь его фактически нет - PlainTransport recvonly, и
    // rtcpFeedback мы вырезаем в createInput. Без SR у демуксера нет
    // надёжной привязки к таймлинии, и после той правки звук пропал совсем.
    //
    // Уплыв звука лечится не здесь, а в aresample на этапе склейки: метки по
    // времени прихода не имеют систематического дрейфа (они привязаны к
    // реальному времени), в них есть только джиттер ±десятки мс.
    '-use_wallclock_as_timestamps', '1',

    '-i', input.sdpPath,
    '-map', '0',

    // ЭТО ПРИЧИНА ТОГО, ЧТО КАРТИНКА ВРАЧА ПРОПАДАЕТ ЗА ПОЛМИНУТЫ ДО КОНЦА.
    //
    // Все дорожки обрываются на SIGKILL, поэтому запись обязана быть
    // устойчивой к обрыву. Логи это доказывают: размеры файлов - ТОЧНЫЕ
    // кратные 64 КБ (786432 = 12x65536, 4980736 = 76x65536), то есть на диск
    // попали только целые блоки буфера AVIO, а хвост пропал вместе с
    // процессом. У кого буфер не успел наполниться, тот и теряет больше:
    // дорожка врача обрывается заметно раньше дорожки пациента, а
    // eof_action=pass обнажает чёрный базовый слой - отсюда "видео врача
    // кончилось раньше".
    //
    // -flush_packets 1 убирает саму причину: каждый пакет сбрасывается на
    // диск сразу, поэтому на SIGKILL теряется один пакет вместо 64 КБ.
    '-flush_packets', '1',

    ...(isAudio
      // СЫРОЙ PCM без контейнера. WAV хранит размер данных в заголовке и
      // правит его при закрытии - у оборванного файла он остаётся нулевым,
      // отсюда "Ignoring maximum wav data size" и "Packet corrupt" в логах
      // склейки. У сырого PCM заголовка нет вообще, поэтому обрыв не портит
      // ничего: читается ровно то, что записано.
      //
      // Моно 48 кГц: речь, дальше всё равно amix в один канал. Это ~96 КБ/с,
      // то есть ~350 МБ на час на участника в /tmp - временные файлы
      // удаляются сразу после склейки.
      ? ['-c:a', 'pcm_s16le', '-ac', '1', '-ar', '48000', '-f', 's16le']
      // Matroska в режиме live: без cues и seekhead в конце файла, размеры
      // кластеров не проставляются задним числом. Именно эта финализация и
      // не происходит при SIGKILL, из-за чего склейка ругалась "File ended
      // prematurely". В live-режиме оборванный файл читается до последнего
      // целого кластера.
      : ['-c', 'copy', '-f', 'matroska', '-live', '1']),

    '-y', input.rawPath,
  ]
}

/**
 * ЭТАП 2: офлайн-склейка отдельных файлов в итоговый WebM.
 *
 * Каждый файл подключается со своим -itsoffset, поэтому дорожки встают на
 * общую таймлинию ровно так, как они шли в реальности. Чёрный канвас задаёт
 * геометрию кадра и живёт всю запись, поэтому пауза или обрыв одного видео
 * не роняет картинку целиком. Здесь нет реального времени: FFmpeg считает
 * столько, сколько нужно, и кадры не теряются.
 */
export function buildComposeArgs(session: RecordingSession, usable: RecordingInput[]): string[] {
  const videos = usable.filter((i) => i.kind === 'video').sort((a, b) => a.slot - b.slot)
  const audios = usable.filter((i) => i.kind === 'audio').sort((a, b) => a.slot - b.slot)
  const withVideo = videos.length > 0
  const offsets = computeOffsets(usable)

  // -progress pipe:1 даёт машинный отчёт о прогрессе в stdout примерно раз в
  // полсекунды. Он нужен composeSegment, чтобы отличать "медленно считает" от
  // "завис": при -loglevel warning в stderr во время нормальной работы тишина,
  // и по нему судить о живости процесса нельзя.
  //
  // ВАЖНО: раз мы это включаем, stdout ОБЯЗАН кто-то читать. Иначе пайп
  // заполнится и FFmpeg встанет на записи в него - то есть ровно то зависание,
  // которое мы пытаемся ловить.
  const args: string[] = ['-loglevel', 'warning', '-nostdin', '-progress', 'pipe:1']
  const streamIndex = new Map<RecordingInput, number>()
  let nextIndex = 0

  if (withVideo) {
    args.push('-f', 'lavfi', '-i', `color=c=black:s=${CANVAS_W}x${CANVAS_H}:r=${OUTPUT_FPS}`)
    nextIndex = 1
  }

  for (const input of [...videos, ...audios]) {
    const offset = offsets.get(input) ?? 0
    // У сырого PCM нет заголовка, поэтому параметры потока задаём здесь -
    // иначе FFmpeg не знает ни частоту, ни разрядность, ни число каналов.
    // Значения обязаны совпадать с записью в buildInputFfmpegArgs.
    if (input.kind === 'audio') {
      args.push('-f', 's16le', '-ar', '48000', '-ac', '1')
    }
    if (offset > 0) args.push('-itsoffset', String(offset))
    args.push('-i', input.rawPath)
    streamIndex.set(input, nextIndex)
    nextIndex += 1
  }

  const filters: string[] = []
  const windowChain = (index: number, name: string) =>
    `[${index}:v]fps=${OUTPUT_FPS},scale=${PANE_W}:${PANE_H}:force_original_aspect_ratio=decrease,` +
    `pad=${PANE_W}:${PANE_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[${name}]`

  if (withVideo) {
    // Каждое видео кладём на канвас. eof_action=pass + repeatlast=0: когда
    // поток участника заканчивается, его половина просто становится чёрной,
    // а запись продолжается (раньше конец одного потока обрезал всё видео).
    let base = '[0:v]'
    videos.forEach((input, position) => {
      const name = position === 0 ? 'w0' : 'w1'
      filters.push(windowChain(streamIndex.get(input) as number, name))
      const x = input.slot === 0 ? 0 : PANE_W
      const isLast = position === videos.length - 1
      const out = isLast ? '[v]' : `[b${position}]`
      const tail = isLast ? ',format=yuv420p' : ''
      filters.push(`${base}[${name}]overlay=x=${x}:y=0:eof_action=pass:repeatlast=0${tail}${out}`)
      base = out
    })
  }

  // Тут лечится уплыв звука. async=1000 (было изначально) разрешал
  // ресемплеру растягивать/сжимать до 1000 сэмплов в секунду, подгоняя звук
  // под джиттерные метки - на часовой записи это давало накопительный уплыв
  // и слышимую порчу тембра. async=1 оставляет только то, что реально нужно:
  // заполнение настоящих разрывов тишиной, с порогом 100 мс, без
  // растягивания сэмплов.
  //
  // first_pts=0 здесь БЫТЬ НЕ ДОЛЖНО: он прибивает начало дорожки к нулю и
  // тем самым отменяет -itsoffset этого входа, то есть ломает ровно ту
  // синхронизацию, ради которой смещения и считаются.
  const RESAMPLE = 'aresample=async=1:min_hard_comp=0.100'

  if (audios.length === 2) {
    const [first, second] = audios
    filters.push(`[${streamIndex.get(first)}:a]${RESAMPLE}[a0]`)
    filters.push(`[${streamIndex.get(second)}:a]${RESAMPLE}[a1]`)
    filters.push(`[a0][a1]amix=inputs=2:duration=longest:normalize=0${withVideo ? ',apad' : ''}[a]`)
  } else if (audios.length === 1) {
    filters.push(`[${streamIndex.get(audios[0])}:a]${RESAMPLE}${withVideo ? ',apad' : ''}[a]`)
  }

  args.push('-filter_complex', filters.join(';'))

  if (withVideo) args.push('-map', '[v]')
  if (audios.length > 0) args.push('-map', '[a]')

  if (withVideo) {
    args.push(
      // Канвас бесконечен, а apad добавляет тишину - длительность задаём сами
      // по реальному времени сегмента.
      '-t', String(session.durationSeconds),
      '-c:v', recordingConfig.videoCodec,
      '-deadline', 'good',
      '-cpu-used', '4',
      '-b:v', '1500k',
      '-g', '60',
      // Постоянная частота кадров на выводе: входные дорожки принципиально
      // VFR (wallclock-метки), и рваные PTS дали бы "плавающий" fps.
      // Осознанно только -r, без -fps_mode cfr: -fps_mode появился в FFmpeg
      // 5.0, а на Ubuntu 20.04 штатный ffmpeg - 4.2, где эта опция валит
      // процесс целиком. CFR и без неё гарантирован: фильтр fps= на каждом
      // окне, чёрный канвас с r=OUTPUT_FPS как база overlay и это -r.
      '-r', String(OUTPUT_FPS),
    )
  }

  args.push(
    '-avoid_negative_ts', 'make_zero',
    '-c:a', recordingConfig.audioCodec,
    '-b:a', '128k',
    '-f', recordingConfig.format,
    '-y', session.filePath,
  )
  return args
}
