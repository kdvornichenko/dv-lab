import { Item } from '@/types/wishlist.types'
import { GiftCard } from './GiftCard'

interface GiftGridProps {
	items: Item[]
	optimisticUpdate: string | null
	onSelectItem: (item: Item) => void
	setIsModalOpen: (isOpen: boolean) => void
	onEditItem: (item: Item) => void
	onDeleteItem: (item: Item) => void
	onHideItem: (item: Item) => void
	isAdmin: boolean
}

export function GiftGrid({
	items,
	optimisticUpdate,
	onSelectItem,
	setIsModalOpen,
	onEditItem,
	onDeleteItem,
	onHideItem,
	isAdmin,
}: GiftGridProps) {
	return (
		<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-6'>
			{items.map(item => (
				<GiftCard
					key={item.id}
					item={item}
					optimisticUpdate={optimisticUpdate}
					onSelect={() => {
						onSelectItem(item)
						setIsModalOpen(true)
					}}
					onEdit={onEditItem}
					onDelete={onDeleteItem}
					onHide={onHideItem}
					isAdmin={isAdmin}
				/>
			))}
		</div>
	)
}
