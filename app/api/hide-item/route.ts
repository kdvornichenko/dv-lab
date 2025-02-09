import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { get } from '@vercel/edge-config'
import { NextResponse } from 'next/server'
import { Item } from '@/types/wishlist.types'

export async function POST(request: Request) {
    try {
        // Проверка авторизации
        const supabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const authHeader = request.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({
                error: 'Unauthorized',
                details: 'Отсутствует токен авторизации'
            }, { status: 401 })
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user || !['weikateach@gmail.com', 'killss999@gmail.com'].includes(user.email || '')) {
            return NextResponse.json({
                error: 'Unauthorized',
                details: 'Недостаточно прав'
            }, { status: 401 })
        }

        // Получаем данные формы
        const requestData = await request.json()
        const itemId = requestData.itemId

        console.log('Получаем данные из Edge Config...')

        // Получаем текущие items используя SDK
        let currentItems = await get('wishlist') as Item[]

        // Если items не существует или не массив, инициализируем пустым массивом
        if (!currentItems || !Array.isArray(currentItems)) {
            console.log('Wishlist не найден или неверный формат, инициализируем пустым массивом')
            currentItems = []
        }

        console.log('Текущий wishlist:', currentItems)

        // Обновляем items
        const updatedItems = currentItems.map(item =>
            item.id === itemId
                ? { ...item, hidden: item.hidden ? false : true }
                : item
        )

        console.log('Обновленные items:', updatedItems)

        // Сохраняем обновленные items используя SDK
        try {
            const response = await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${process.env.VERCEL_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: [
                        {
                            key: 'wishlist',
                            value: updatedItems,
                            operation: 'upsert'
                        }
                    ]
                }),
            })

            const responseData = await response.text()
            console.log('Edge Config response:', {
                status: response.status,
                data: responseData,
                url: response.url,
                body: JSON.stringify({
                    items: [{ key: 'wishlist', value: updatedItems, operation: 'upsert' }]
                }),
                headers: Object.fromEntries(response.headers.entries())
            })

            if (!response.ok) {
                throw new Error(`Edge Config ответил с ошибкой: ${response.status} ${responseData}`)
            }

            console.log('Items успешно обновлены')
        } catch (setError) {
            console.error('Ошибка при обновлении items:', setError)
            throw new Error(`Ошибка сохранения данных: ${setError instanceof Error ? setError.message : 'Неизвестная ошибка'}`)
        }

        return NextResponse.json({
            success: true,
            message: 'Данные успешно обновлены'
        })

    } catch (error) {
        console.error('Ошибка обработки запроса:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }, { status: 500 })
    }
} 