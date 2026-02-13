'use client'

import { PlusIcon } from '@heroicons/react/24/outline'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AdminEditModal } from '@/components/wishlist/AdminEditModal'
import { BookingModal } from '@/components/wishlist/BookingModal'
import { GiftCard } from '@/components/wishlist/GiftCard'

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
		return <Loader2 className="absolute top-1/2 left-1/2 z-50 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin" />
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
				<div className="mb-4 flex justify-end">
					<Button onClick={() => setIsAddModalOpen(true)}>
						<PlusIcon className="mr-2 h-5 w-5" />
						Добавить подарок
					</Button>
				</div>
			)}

			<div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
				{items.map((item) => (
					<GiftCard
						key={item.id}
						item={item}
						optimisticUpdate={optimisticUpdate}
						onSelect={() => {
							setSelectedItem(item)
							setIsModalOpen(true)
						}}
						onEdit={handleEditItem}
						onDelete={handleDeleteItem}
						onHide={handleHideItem}
						isAdmin={isAdmin}
					/>
				))}
			</div>
		</div>
	)
}
