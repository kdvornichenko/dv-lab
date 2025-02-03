import { list } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function GET() {
    const { blobs } = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return NextResponse.json(blobs.map(blob => ({
        url: blob.url,
        pathname: blob.pathname
    })))
}