import { BlobObject } from '@/types/wishlist.types'
import { Item } from '@/types/wishlist.types'
import { GiftCard } from './GiftCard'

interface GiftGridProps {
	items: Item[]
	blobs: BlobObject[]
	optimisticUpdate: string | null
	onSelectItem: (item: Item) => void
	setIsModalOpen: (isOpen: boolean) => void
	onEditItem: (item: Item) => void
	onDeleteItem: (item: Item) => void
	isAdmin: boolean
}

export function GiftGrid({
	items,
	blobs,
	optimisticUpdate,
	onSelectItem,
	setIsModalOpen,
	onEditItem,
	onDeleteItem,
	isAdmin,
}: GiftGridProps) {
	const getImageUrl = (itemId: string) => {
		const fileBlobs = blobs.filter(blob => !blob.pathname.endsWith('/'))
		const foundBlob = fileBlobs.find(blob => {
			const filename = blob.pathname.split('/').pop() || ''
			return (
				filename.startsWith(`${itemId}-`) || filename.startsWith(`${itemId}.`)
			)
		})
		return foundBlob ? foundBlob.url : '/img/placeholder.jpg'
	}

	return (
		<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-6'>
			{items.map(item => (
				<GiftCard
					key={item.id}
					item={item}
					imageUrl={getImageUrl(item.id)}
					optimisticUpdate={optimisticUpdate}
					onSelect={() => {
						onSelectItem(item)
						setIsModalOpen(true)
					}}
					onEdit={onEditItem}
					onDelete={onDeleteItem}
					isAdmin={isAdmin}
				/>
			))}
		</div>
	)
}
