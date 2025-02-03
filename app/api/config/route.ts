import { get } from '@vercel/edge-config'

export const runtime = 'edge'
export const dynamic = 'force-dynamic' // Отключаем кэширование Next.js

export async function GET() {
    try {
        const value = await get('wishlist')

        return new Response(JSON.stringify(value), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0' // Отключаем кэширование
            }
        })
    } catch (error) {
        console.error('Error fetching config:', error)
        return new Response(JSON.stringify({ error: 'Ошибка получения данных' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            }
        })
    }
}