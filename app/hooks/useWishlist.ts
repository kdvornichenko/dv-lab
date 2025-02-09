import { useState, useEffect } from 'react'

import { Item, BlobObject } from '@/types/wishlist.types'
import supabase from '@/libs/supabase/supabaseClient'

export function useWishlist() {
    const [items, setItems] = useState<Item[]>([])
    const [blobs, setBlobs] = useState<BlobObject[]>([])
    const [selectedItem, setSelectedItem] = useState<Item | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [optimisticUpdate, setOptimisticUpdate] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            const { data: session, error } = await supabase.auth.getSession()

            if (error || !session?.session?.user?.email) {
                console.error('User not authenticated')
                return
            }

            const userEmail = session.session.user.email
            setIsAdmin(['weikateach@gmail.com', 'killss999@gmail.com'].includes(userEmail))
        }

        checkAuth()
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [itemsResponse, blobsResponse] = await Promise.all([
                    fetch('/api/config', { cache: 'no-store' }),
                    fetch('/api/blobs', { cache: 'no-store' }),
                ])

                const itemsData = await itemsResponse.json()
                const blobsData = await blobsResponse.json()

                setItems(itemsData)
                setBlobs(blobsData)
            } catch (error) {
                console.error('Ошибка при загрузке данных:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [])

    const handleBookGift = async () => {
        if (!selectedItem) return

        try {
            setOptimisticUpdate(selectedItem.id)
            setItems(prev =>
                prev.map(item =>
                    item.id === selectedItem.id ? { ...item, booked: true } : item
                )
            )

            const response = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: selectedItem.id }),
            })

            if (!response.ok) {
                throw new Error('Ошибка бронирования')
            }
        } catch (error) {
            console.error('Ошибка:', error)
        } finally {
            setOptimisticUpdate(null)
            setIsModalOpen(false)
            setSelectedItem(null)
        }
    }

    const handleEditItem = async (item: Item) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError || !session) {
                throw new Error('Ошибка авторизации')
            }

            const formData = new FormData()
            formData.append('itemId', item.id)
            formData.append('price', item.price.toString())
            formData.append('description', item.description)
            formData.append('href', item.href)
            if (item.image) {
                formData.append('image', item.image)
            }

            const response = await fetch('/api/edit-item', {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            })

            if (!response.ok) {
                throw new Error('Ошибка обновления подарка')
            }

            setItems(prev => prev.map(selectedItem => (selectedItem.id === item.id ? item : selectedItem)))
            setIsEditModalOpen(false)
        } catch (error) {
            console.error('Edit operation failed:', error)
            alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
        }
    }

    const getImageUrl = (itemId: string) => {
        const fileBlobs = blobs.filter(blob => !blob.pathname.endsWith('/'))
        const foundBlob = fileBlobs.find(blob => {
            const filename = blob.pathname.split('/').pop() || ''
            return filename.startsWith(`${itemId}-`) || filename.startsWith(`${itemId}.`)
        })
        return foundBlob ? foundBlob.url : '/img/placeholder.jpg'
    }

    const handleDeleteItem = async (item: Item) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError || !session) {
                throw new Error('Ошибка авторизации')
            }

            const confirm = window.confirm('Вы уверены, что хотите удалить этот подарок? Отменить это действие невозможно.')

            if (!confirm) return

            setItems(prev =>
                prev.filter(i =>
                    i.id !== item.id
                )
            )

            const response = await fetch('/api/hide-item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ itemId: item.id }),
            })

            if (!response.ok) {
                throw new Error('Ошибка удаления подарка')
            }
        } catch (error) {
            console.error('Delete operation failed:', error)
            alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
        }
    }

    const handleHideItem = async (item: Item) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()


            if (sessionError || !session) {
                throw new Error('Ошибка авторизации')
            }

            setItems(prev =>
                prev.map(selectedItem =>
                    selectedItem.id === item.id ? { ...selectedItem, hidden: selectedItem.hidden ? false : true } : selectedItem
                )
            )

            const response = await fetch('/api/hide-item', {
                method: 'POST',
                headers: {

                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ itemId: item.id }),
            })

            if (!response.ok) {
                throw new Error('Ошибка скрытия подарка')
            }
        } catch (error) {
            console.error('Hide operation failed:', error)
            alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
        }
    }

    return {
        items,
        blobs,
        isAdmin,
        isLoading,
        selectedItem,
        isModalOpen,
        isEditModalOpen,
        optimisticUpdate,
        handleBookGift,
        handleEditItem,
        handleDeleteItem,
        handleHideItem,
        setIsModalOpen,
        setIsEditModalOpen,
        setSelectedItem,
        setItems,
        getImageUrl,
    }
} 