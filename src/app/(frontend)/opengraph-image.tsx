import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/seo'

/**
 * Картинка для превью ссылок в мессенджерах и соцсетях.
 *
 * Лежит в корне группы (frontend), поэтому наследуется всеми страницами внутри:
 * отдельная картинка на каждый раздел не нужна, заголовок и описание превью
 * всё равно берутся из метаданных конкретной страницы.
 *
 * Собирается из реального логотипа проекта (public/images/logo.jpg) и цветов
 * из globals.css — ничего дорисованного вручную.
 */

export const alt = 'smartcardio — видеоконсультации с врачами'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Цвета продублированы литералами: ImageResponse не понимает CSS-переменные. */
const FOREGROUND = '#0a0a0a'
const MUTED = '#63697a'
const PRIMARY = '#704ca6'
const TEAL = '#009ba3'

/**
 * Логотип читается с диска, а не через fetch(new URL(..., import.meta.url)).
 *
 * Turbopack (бандлер по умолчанию в Next 16) заменяет такой импорт на путь вида
 * /_next/static/media/logo.<hash>.jpg. Это относительный путь, а fetch требует
 * абсолютный, поэтому вариант с import.meta.url падал с ERR_INVALID_URL.
 *
 * Ошибка чтения не должна ломать страницу целиком: без картинки превью ссылки
 * просто останется текстовым, а вот ImageResponse с исключением отдаёт 500 и
 * мессенджеры показывают пустоту.
 */
async function readLogo(): Promise<ArrayBuffer | null> {
  try {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const file = await readFile(join(process.cwd(), 'public', 'images', 'logo.jpg'))
    return Uint8Array.from(file).buffer
  } catch (error) {
    console.log('[og] Не удалось прочитать логотип:', error)
    return null
  }
}

export default async function OpengraphImage() {
  const logo = await readLogo()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 56,
            padding: '0 80px',
            flex: 1,
          }}
        >
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element -- ImageResponse рендерит в PNG, next/image здесь неприменим */
            <img src={logo as unknown as string} alt="" width={260} height={204} />
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/*
              Satori (движок ImageResponse) требует явный display у любого div
              с несколькими детьми. Здесь две строки заголовка, поэтому вместо
              <br /> они разложены в колонку — иначе рендер падает с ошибкой
              «Expected <div> to have explicit display: flex».
            */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontSize: 62,
                fontWeight: 700,
                color: FOREGROUND,
                lineHeight: 1.1,
              }}
            >
              <span>Видеоконсультации</span>
              <span>с врачами</span>
            </div>
            <div style={{ fontSize: 30, color: MUTED, lineHeight: 1.4 }}>
              Приём онлайн, не выходя из дома
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 26, color: MUTED, padding: '0 80px 36px' }}>{SITE_NAME}</div>
          {/* Единственный акцент: фирменная линия из цветов --primary и --teal. */}
          <div
            style={{
              height: 14,
              background: `linear-gradient(90deg, ${PRIMARY} 0%, ${TEAL} 100%)`,
            }}
          />
        </div>
      </div>
    ),
    size,
  )
}
