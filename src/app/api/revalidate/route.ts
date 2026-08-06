import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories.server'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'

// Secret token for revalidation (optional - can be set in env)
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET

/**
 * API endpoint to manually trigger cache revalidation.
 * 
 * Usage:
 * - POST /api/revalidate?tags=categories,doctors
 * - POST /api/revalidate?tag=categories
 * - POST /api/revalidate?all=true (revalidates all known tags)
 * 
 * If REVALIDATION_SECRET is set, include it in Authorization header:
 * Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  // Check secret if configured
  if (REVALIDATION_SECRET) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token !== REVALIDATION_SECRET) {
      return NextResponse.json(
        { error: 'Invalid revalidation secret' },
        { status: 401 }
      )
    }
  }

  const { searchParams } = new URL(request.url)
  const tagsParam = searchParams.get('tags')
  const tagParam = searchParams.get('tag')
  const all = searchParams.get('all')

  const revalidatedTags: string[] = []

  // Revalidate all known tags
  if (all === 'true') {
    revalidateTag(CATEGORIES_CACHE_TAG)
    revalidateTag(DOCTORS_CACHE_TAG)
    revalidatedTags.push(CATEGORIES_CACHE_TAG, DOCTORS_CACHE_TAG)
  } else {
    // Parse tags from query params
    const tags: string[] = []
    
    if (tagsParam) {
      tags.push(...tagsParam.split(',').map(t => t.trim()))
    }
    
    if (tagParam) {
      tags.push(tagParam.trim())
    }

    if (tags.length === 0) {
      return NextResponse.json(
        { error: 'No tags specified. Use ?tag=categories or ?tags=categories,doctors or ?all=true' },
        { status: 400 }
      )
    }

    // Validate and revalidate tags
    const validTags = [CATEGORIES_CACHE_TAG, DOCTORS_CACHE_TAG]
    
    for (const tag of tags) {
      if (validTags.includes(tag)) {
        revalidateTag(tag)
        revalidatedTags.push(tag)
      }
    }
  }

  if (revalidatedTags.length === 0) {
    return NextResponse.json(
      { error: 'No valid tags found. Valid tags: categories, doctors' },
      { status: 400 }
    )
  }

  console.log(`[Revalidation] Revalidated tags: ${revalidatedTags.join(', ')}`)

  return NextResponse.json({
    revalidated: true,
    tags: revalidatedTags,
    timestamp: new Date().toISOString(),
  })
}

// Also support GET for simple browser-based testing
export async function GET(request: NextRequest) {
  return POST(request)
}
