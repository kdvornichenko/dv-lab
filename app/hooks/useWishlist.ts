import { useEffect, useRef, useState } from 'react'

import {
	getWishlistItems,
	bookWishlistItem,
	updateWishlistItem,
	addWishlistItem,
	updateWishlistItemImageUrl,
	deleteWishlistItem,
	toggleWishlistItemHidden,
} from '@/app/actions/wishlist'
import supabase from '@/libs/supabase/supabaseClient'
import { Item } from '@/types/wishlist.types'

export function useWishlist() {
	const [items, setItems] = useState<Item[]>([])
	const [selectedItem, setSelectedItem] = useState<Item | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [optimisticUpdate, setOptimisticUpdate] = useState<string | null>(null)
	const [isAdmin, setIsAdmin] = useState(false)
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const [isAddModalOpen, setIsAddModalOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const isAddInFlightRef = useRef(false)

	useEffect(() => {
		const checkAuth = async () => {
			const { data: session, error } = await supabase.auth.getSession()

			if (error || !session?.session?.user?.email) {
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
				const data = await getWishlistItems()
				setItems(data as Item[])
			} catch (error) {
				console.error('Ошибка при загрузке данных:', error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchData()
	}, [])

	const uploadImage = async (itemId: string, file: File): Promise<string> => {
		const ext = file.name.split('.').pop()
		const filePath = `${itemId}.${ext}`

		const { error } = await supabase.storage.from('wishlist-images').upload(filePath, file, { upsert: true })

		if (error) throw error

		const { data: urlData } = supabase.storage.from('wishlist-images').getPublicUrl(filePath)

		return urlData.publicUrl
	}

	const handleBookGift = async () => {
		if (!selectedItem) return

		try {
			setOptimisticUpdate(selectedItem.id)
			setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, booked: true } : item)))

			await bookWishlistItem(selectedItem.id)
		} catch (error) {
			console.error('Ошибка:', error)
			setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, booked: false } : item)))
		} finally {
			setOptimisticUpdate(null)
			setIsModalOpen(false)
			setSelectedItem(null)
		}
	}

	const handleEditItem = async (item: Item) => {
		try {
			let imageUrl = item.image_url

			if (item.image) {
				imageUrl = await uploadImage(item.id, item.image)
			}

			await updateWishlistItem(item.id, {
				description: item.description,
				price: item.price,
				href: item.href,
				image_url: imageUrl,
			})

			setItems((prev) =>
				prev.map((existing) =>
					existing.id === item.id
						? { ...existing, description: item.description, price: item.price, href: item.href, image_url: imageUrl }
						: existing
				)
			)
			setIsEditModalOpen(false)
		} catch (error) {
			console.error('Edit operation failed:', error)
			alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
		}
	}

	const handleAddItem = async (item: Item) => {
		if (isAddInFlightRef.current) {
			return
		}

		isAddInFlightRef.current = true

		try {
			const newItem = await addWishlistItem({
				description: item.description,
				price: item.price,
				href: item.href,
			})

			let imageUrl: string | null = null
			if (item.image) {
				imageUrl = await uploadImage(newItem.id, item.image)
				await updateWishlistItemImageUrl(newItem.id, imageUrl)
			}

			setItems((prev) => [...prev, { ...newItem, image_url: imageUrl } as Item])
			setIsAddModalOpen(false)
		} catch (error) {
			console.error('Add operation failed:', error)
			alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
		} finally {
			isAddInFlightRef.current = false
		}
	}

	const handleDeleteItem = async (item: Item) => {
		try {
			const confirm = window.confirm('Вы уверены, что хотите удалить этот подарок? Отменить это действие невозможно.')
			if (!confirm) return

			setItems((prev) => prev.filter((i) => i.id !== item.id))
			await deleteWishlistItem(item.id)
		} catch (error) {
			console.error('Delete operation failed:', error)
			alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
		}
	}

	const handleHideItem = async (item: Item) => {
		try {
			const newHidden = !item.hidden

			setItems((prev) =>
				prev.map((existing) => (existing.id === item.id ? { ...existing, hidden: newHidden } : existing))
			)

			await toggleWishlistItemHidden(item.id, newHidden)
		} catch (error) {
			console.error('Hide operation failed:', error)
			alert(error instanceof Error ? error.message : 'Произошла неизвестная ошибка')
		}
	}

	return {
		items,
		isAdmin,
		isLoading,
		selectedItem,
		isModalOpen,
		isEditModalOpen,
		isAddModalOpen,
		optimisticUpdate,
		handleBookGift,
		handleEditItem,
		handleAddItem,
		handleDeleteItem,
		handleHideItem,
		setIsModalOpen,
		setIsEditModalOpen,
		setIsAddModalOpen,
		setSelectedItem,
		setItems,
	}
}
