'use client'

import React from 'react'
import { Spinner } from '@nextui-org/react'
import { GiftGrid } from '@/components/wishlist/GiftGrid'
import { AdminEditModal } from '@/components/wishlist/AdminEditModal'
import { BookingModal } from '@/components/wishlist/BookingModal'
import { useWishlist } from '../hooks/useWishlist'

export default function WishlistPage() {
	const {
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
		setIsModalOpen,
		setIsEditModalOpen,
		setSelectedItem,
	} = useWishlist()

	if (isLoading) {
		return (
			<Spinner className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50' />
		)
	}

	return (
		<div>
			<AdminEditModal
				isOpen={isEditModalOpen}
				onOpenChange={setIsEditModalOpen}
				selectedItem={selectedItem}
				onEditItem={handleEditItem}
			/>

			<BookingModal
				isOpen={isModalOpen}
				onOpenChange={setIsModalOpen}
				selectedItem={selectedItem}
				optimisticUpdate={optimisticUpdate}
				onBook={handleBookGift}
			/>

			<GiftGrid
				items={items}
				blobs={blobs}
				optimisticUpdate={optimisticUpdate}
				onSelectItem={setSelectedItem}
				setIsModalOpen={setIsModalOpen}
				onEditItem={item => {
					setSelectedItem(item)
					setIsEditModalOpen(true)
				}}
				onDeleteItem={handleDeleteItem}
				isAdmin={isAdmin}
			/>
		</div>
	)
}
