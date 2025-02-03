import { NextResponse } from 'next/server'

interface Item {
    id: string
    price: number
    description: string
    href: string
    booked?: boolean
}

interface EdgeConfigItem {
    key: string
    value: unknown
    createdAt?: number
    updatedAt?: number
    edgeConfigId?: string
}

interface EdgeConfigUpdateOperation {
    operation: 'update'
    key: string
    value: unknown
}

export const runtime = 'edge'

export async function POST(request: Request) {
    try {
        // Проверка переменных окружения
        if (!process.env.EDGE_CONFIG_ID || !process.env.VERCEL_ACCESS_TOKEN) {
            throw new Error('Missing environment variables')
        }

        // Парсинг тела запроса
        const { itemId }: { itemId?: string } = await request.json()
        if (!itemId) {
            return NextResponse.json(
                { error: "Missing itemId in request body" },
                { status: 400 }
            )
        }

        // Конфигурация API
        const EDGE_CONFIG_API = `https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}`
        const headers = {
            'Authorization': `Bearer ${process.env.VERCEL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }

        // Шаг 1: Получение текущих данных
        const getResponse = await fetch(`${EDGE_CONFIG_API}/items`, { headers })

        if (!getResponse.ok) {
            const errorText = await getResponse.text()
            console.error('Vercel API GET Error:', errorText)
            return NextResponse.json(
                { error: "Failed to fetch config", details: errorText },
                { status: getResponse.status }
            )
        }

        const responseData: EdgeConfigItem[] = await getResponse.json()

        // Шаг 2: Поиск wishlist в массиве
        const wishlistItem = responseData.find((item): item is EdgeConfigItem & { value: Item[] } =>
            item.key === 'wishlist' && Array.isArray(item.value)
        )

        if (!wishlistItem) {
            return NextResponse.json(
                { error: "Wishlist not found in Edge Config or invalid format" },
                { status: 404 }
            )
        }

        // Проверка структуры элементов wishlist
        const isValidWishlist = wishlistItem.value.every(item =>
            typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            'price' in item &&
            'description' in item &&
            'href' in item
        )

        if (!isValidWishlist) {
            throw new Error('Invalid wishlist items structure')
        }

        // Шаг 3: Обновление данных
        const updatedWishlist: Item[] = wishlistItem.value.map(item =>
            item.id === itemId ? { ...item, booked: true } : item
        )

        // Шаг 4: Отправка обновлений
        const patchBody: { items: EdgeConfigUpdateOperation[] } = {
            items: [{
                operation: 'update',
                key: 'wishlist',
                value: updatedWishlist
            }]
        }

        const patchResponse = await fetch(`${EDGE_CONFIG_API}/items`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(patchBody)
        })

        if (!patchResponse.ok) {
            const errorText = await patchResponse.text()
            console.error('Vercel API PATCH Error:', errorText)
            return NextResponse.json(
                { error: "Failed to update config", details: errorText },
                { status: patchResponse.status }
            )
        }

        return NextResponse.json({ success: true })

    } catch (error: unknown) {
        console.error('Internal Server Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            {
                error: "Internal Server Error",
                details: errorMessage
            },
            { status: 500 }
        )
    }
}