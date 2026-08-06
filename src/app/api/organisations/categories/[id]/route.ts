import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import jwt from 'jsonwebtoken'
import { extractCookie } from '@/lib/auth-cookies'

const COOKIE_NAME = 'organisations-token'

// GET - получить категорию по ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })

    const category = await payload.findByID({
      collection: 'doctor-categories',
      id: parseInt(id, 10),
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(category)
  } catch (err: unknown) {
    console.error('[v0] Category fetch error:', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch category'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH - обновить категорию
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieHeader = req.headers.get('cookie') || ''
    const token = extractCookie(cookieHeader, COOKIE_NAME)

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: No organisation token' },
        { status: 401 }
      )
    }

    const payload = await getPayload({ config: configPromise })

    let decoded: { id?: string | number; collection?: string; email?: string } | null = null
    try {
      decoded = jwt.verify(token, payload.secret) as { id?: string | number; collection?: string; email?: string }
    } catch (_ignore) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      )
    }

    if (!decoded?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: No organisation ID' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, slug, description, icon, iconImage } = body

    console.log('[v0] Updating category:', { id, organisationId: decoded.id, name, slug })

    const category = await payload.update({
      collection: 'doctor-categories',
      id: parseInt(id, 10),
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description: description || null }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(iconImage !== undefined && { iconImage: iconImage || null }),
      },
      overrideAccess: true,
    })

    return NextResponse.json(category)
  } catch (err: unknown) {
    console.error('[v0] Category update error:', err)
    
    const errMsg = err instanceof Error ? err.message : ''
    if (errMsg.includes('unique')) {
      return NextResponse.json(
        { error: 'Слаг должен быть уникальным' },
        { status: 400 }
      )
    }

    const message = errMsg || 'Failed to update category'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE - удалить категорию
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieHeader = req.headers.get('cookie') || ''
    const token = extractCookie(cookieHeader, COOKIE_NAME)

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: No organisation token' },
        { status: 401 }
      )
    }

    const payload = await getPayload({ config: configPromise })

    let decoded: { id?: string | number; collection?: string; email?: string } | null = null
    try {
      decoded = jwt.verify(token, payload.secret) as { id?: string | number; collection?: string; email?: string }
    } catch (_ignore) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      )
    }

    if (!decoded?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: No organisation ID' },
        { status: 401 }
      )
    }

    console.log('[v0] Deleting category:', { id, organisationId: decoded.id })

    // Check if category has doctors assigned
    const doctorsWithCategory = await payload.find({
      collection: 'doctors',
      where: {
        category: { equals: parseInt(id, 10) },
      },
      limit: 1,
    })

    if (doctorsWithCategory.docs.length > 0) {
      return NextResponse.json(
        { error: 'Невозможно удалить категорию, к которой привязаны врачи' },
        { status: 400 }
      )
    }

    await payload.delete({
      collection: 'doctor-categories',
      id: parseInt(id, 10),
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[v0] Category delete error:', err)
    const message = err instanceof Error ? err.message : 'Failed to delete category'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
