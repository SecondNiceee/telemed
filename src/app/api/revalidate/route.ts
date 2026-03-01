import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * POST /api/revalidate
 * Body: { tag: string }
 * Called client-side after mutations to invalidate Next.js Data Cache tags.
 * No auth needed — tags are not secret, revalidation is idempotent.
 */
export async function POST(req: Request) {
  try {
    const { tag } = await req.json()
    if (!tag || typeof tag !== 'string') {
      return NextResponse.json({ error: 'Missing tag' }, { status: 400 })
    }
    revalidateTag(tag)
    return NextResponse.json({ revalidated: true, tag })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
