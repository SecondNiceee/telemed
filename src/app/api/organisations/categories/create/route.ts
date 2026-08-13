import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import jwt from 'jsonwebtoken'
import { extractCookie } from '@/lib/auth-cookies'

const COOKIE_NAME = 'organisations-token'

/** Verbose, always-visible server log helper for this endpoint. */
function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log('[categories:create]', ...args)
}

function logError(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.error('[categories:create][ERROR]', ...args)
}

/** Serialize any thrown value so nothing gets swallowed in the logs. */
function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      // Payload validation errors carry extra data
      ...(('data' in err) ? { data: (err as unknown as { data: unknown }).data } : {}),
      ...(('status' in err) ? { status: (err as unknown as { status: unknown }).status } : {}),
      ...(('cause' in err && err.cause) ? { cause: String(err.cause) } : {}),
    }
  }
  try {
    return { nonError: JSON.stringify(err) }
  } catch {
    return { nonError: String(err) }
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  const requestId = Math.random().toString(36).slice(2, 10)

  log(`--> POST /api/organisations/categories/create [req:${requestId}]`)

  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const token = extractCookie(cookieHeader, COOKIE_NAME)

    if (!token) {
      logError(`[req:${requestId}] no ${COOKIE_NAME} cookie present`)
      return NextResponse.json(
        { error: 'Unauthorized: No organisation token' },
        { status: 401 }
      )
    }

    const payload = await getPayload({ config: configPromise })

    let decoded: { id?: string | number; collection?: string; email?: string } | null = null
    try {
      decoded = jwt.verify(token, payload.secret) as { id?: string | number; collection?: string; email?: string }
    } catch (jwtErr) {
      logError(`[req:${requestId}] JWT verification failed`, describeError(jwtErr))
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      )
    }

    if (!decoded?.id) {
      logError(`[req:${requestId}] token decoded but has no id`, { decoded })
      return NextResponse.json(
        { error: 'Unauthorized: No organisation ID' },
        { status: 401 }
      )
    }

    // Get request body
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch (parseErr) {
      logError(`[req:${requestId}] failed to parse JSON body`, describeError(parseErr))
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name, slug, description, icon, iconImage } = body as {
      name?: string
      slug?: string
      description?: string
      icon?: string
      iconImage?: unknown
    }

    log(`[req:${requestId}] payload received`, {
      organisationId: decoded.id,
      name,
      slug,
      hasDescription: Boolean(description),
      icon: icon ?? null,
      iconImage,
      iconImageType: typeof iconImage,
    })

    if (!name || !slug) {
      logError(`[req:${requestId}] validation failed: name/slug missing`, { name, slug })
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Normalize iconImage: Payload expects a numeric/string relation ID, not an object
    let iconImageId: number | string | undefined
    if (iconImage !== undefined && iconImage !== null && iconImage !== '') {
      if (typeof iconImage === 'object' && iconImage !== null && 'id' in iconImage) {
        iconImageId = (iconImage as { id: number | string }).id
      } else if (typeof iconImage === 'number' || typeof iconImage === 'string') {
        iconImageId = iconImage
      } else {
        logError(`[req:${requestId}] unsupported iconImage value, ignoring`, { iconImage })
      }
    }

    // Verify the referenced media doc actually exists — a dangling relation
    // is a common cause of an opaque failure during create.
    if (iconImageId !== undefined) {
      try {
        const media = await payload.findByID({
          collection: 'media',
          id: iconImageId as number,
        })
        log(`[req:${requestId}] iconImage media resolved`, {
          id: media?.id,
          filename: (media as unknown as { filename?: string })?.filename,
          mimeType: (media as unknown as { mimeType?: string })?.mimeType,
        })
      } catch (mediaErr) {
        logError(`[req:${requestId}] iconImage media NOT found`, {
          iconImageId,
          ...describeError(mediaErr),
        })
        return NextResponse.json(
          { error: `Загруженная иконка не найдена (id: ${String(iconImageId)}). Загрузите файл заново.` },
          { status: 400 },
        )
      }
    }

    log(`[req:${requestId}] calling payload.create`, {
      collection: 'doctor-categories',
      name,
      slug,
      iconImageId: iconImageId ?? null,
    })

    // Create category - use overrideAccess because this is a special endpoint
    // The organisation is authenticated via their own token, not Payload's auth system
    let category
    try {
      category = await payload.create({
        collection: 'doctor-categories',
        data: {
          name,
          slug,
          description: description || undefined,
          icon: icon || undefined,
          iconImage: iconImageId as number | undefined,
        },
        overrideAccess: true,
        user: {
          id: decoded.id,
          collection: 'organisations',
          role: 'organisation',
          email: decoded.email,
        } as unknown as Record<string, unknown>,
      })
    } catch (createErr) {
      logError(`[req:${requestId}] payload.create threw`, describeError(createErr))
      throw createErr
    }

    log(`[req:${requestId}] <-- created OK in ${Date.now() - startedAt}ms`, {
      id: category?.id,
      slug: category?.slug,
    })

    return NextResponse.json(category)
  } catch (err: unknown) {
    const described = describeError(err)
    logError(`[req:${requestId}] unhandled failure after ${Date.now() - startedAt}ms`, described)

    // Check for duplicate slug error
    const errMsg = err instanceof Error ? err.message : ''
    if (errMsg.includes('unique') || errMsg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Слаг должен быть уникальным' },
        { status: 400 }
      )
    }

    const message = errMsg || 'Failed to create category'
    return NextResponse.json(
      { error: message, details: described },
      { status: 500 }
    )
  }
}
