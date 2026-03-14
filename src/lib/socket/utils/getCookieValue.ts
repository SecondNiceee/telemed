// Получаю значение куки
export default function getCookieValue(cookieString: string, name: string): string | null {
    const match = cookieString.match(new RegExp(`${name}=([^;]+)`))
    return match ? match[1] : null
  }
  