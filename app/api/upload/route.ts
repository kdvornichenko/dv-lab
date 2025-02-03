// app/api/upload/route.ts
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const filename = formData.get('filename') as string

  const blob = await put(filename, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })

  return NextResponse.json(blob)
}