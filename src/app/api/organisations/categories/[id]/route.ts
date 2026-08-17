import { NextResponse } from 'next/server'

const forbidden = () =>
  NextResponse.json(
    { error: 'Управление специальностями доступно только администратору' },
    { status: 403 },
  )

export async function GET() {
  return forbidden()
}

export async function PATCH() {
  return forbidden()
}

export async function DELETE() {
  return forbidden()
}
