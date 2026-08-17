import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Управление специальностями доступно только администратору' },
    { status: 403 },
  )
}
