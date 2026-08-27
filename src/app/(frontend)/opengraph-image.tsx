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

export default async function OpengraphImage() {
  // Официальный способ подключить локальный ассет в next/og: путь относительно
  // самого модуля, а не process.cwd(). В serverless-функции каталог public
  // на файловой системе может отсутствовать, поэтому fs.readFile ненадёжен.
  const logo = await fetch(new URL('../../../public/images/logo.jpg', import.meta.url)).then(
    (response) => response.arrayBuffer(),
  )

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
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse рендерит в PNG, next/image здесь неприменим */}
          <img src={logo as unknown as string} alt="" width={260} height={204} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 62, fontWeight: 700, color: FOREGROUND, lineHeight: 1.1 }}>
              Видеоконсультации
              <br />
              с врачами
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
