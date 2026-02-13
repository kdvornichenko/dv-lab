'use client'

import React from 'react'
import { Spinner } from '@nextui-org/react'
import { Button } from '@nextui-org/react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { GiftGrid } from '@/components/wishlist/GiftGrid'
import { AdminEditModal } from '@/components/wishlist/AdminEditModal'
import { BookingModal } from '@/components/wishlist/BookingModal'
import { useWishlist } from '../hooks/useWishlist'

export default function WishlistPage() {
	const {
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

			<AdminEditModal
				isOpen={isAddModalOpen}
				onOpenChange={setIsAddModalOpen}
				selectedItem={{ id: '', description: '', price: 0, href: '', booked: false, hidden: false, image_url: null }}
				onEditItem={handleAddItem}
				isNew
			/>

			<BookingModal
				isOpen={isModalOpen}
				onOpenChange={setIsModalOpen}
				selectedItem={selectedItem}
				optimisticUpdate={optimisticUpdate}
				onBook={handleBookGift}
			/>

			{isAdmin && (
				<div className='flex justify-end mb-4'>
					<Button
						color='primary'
						startContent={<PlusIcon className='h-5 w-5' />}
						onPress={() => setIsAddModalOpen(true)}
					>
						Добавить подарок
					</Button>
				</div>
			)}

			<GiftGrid
				items={items}
				optimisticUpdate={optimisticUpdate}
				onSelectItem={setSelectedItem}
				setIsModalOpen={setIsModalOpen}
				onEditItem={item => {
					setSelectedItem(item)
					setIsEditModalOpen(true)
				}}
				onDeleteItem={handleDeleteItem}
				onHideItem={handleHideItem}
				isAdmin={isAdmin}
			/>
		</div>
	)
}
