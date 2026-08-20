import 'server-only'

export interface PublicIceServer {
  urls: string[]
  username?: string
  credential?: string
}

function parseUrls(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
}

export function getIceServers(): PublicIceServer[] {
  const stunUrls = parseUrls(process.env.STUN_URLS)
  const turnUrls = parseUrls(process.env.TURN_URLS)
  const username = process.env.TURN_USERNAME?.trim()
  const credential = process.env.TURN_CREDENTIAL?.trim()
  const servers: PublicIceServer[] = []

  if (stunUrls.length > 0) servers.push({ urls: stunUrls })

  if (turnUrls.length > 0) {
    if (!username || !credential) {
      throw new Error('TURN_USERNAME and TURN_CREDENTIAL are required when TURN_URLS is configured')
    }
    servers.push({ urls: turnUrls, username, credential })
  }

  return servers
}
