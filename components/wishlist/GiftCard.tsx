import { EllipsisVerticalIcon } from '@heroicons/react/24/outline'

import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Item } from '@/types/wishlist.types'

interface GiftCardProps {
	item: Item
	optimisticUpdate?: string | null
	onSelect?: () => void
	onEdit?: (item: Item) => void
	onDelete?: (item: Item) => void
	onHide?: (item: Item) => void
	isAdmin?: boolean
}

export function GiftCard({ item, optimisticUpdate, onSelect, onEdit, onDelete, onHide, isAdmin }: GiftCardProps) {
	const imageUrl = item.image_url || '/img/placeholder.jpg'
	const handleEditSelect = () => {
		window.setTimeout(() => onEdit?.(item), 0)
	}

	return item.hidden && !isAdmin ? null : (
		<div className="relative">
			<div className="absolute top-2 right-2 left-2 z-20 flex flex-col gap-2">
				{(item.booked || (optimisticUpdate === item.id && !item.hidden)) && (
					<div className="rounded-lg bg-wishlist-pink py-1 text-center text-black">Подарок забронирован</div>
				)}

				{isAdmin && item.hidden && (
					<div className="rounded-lg bg-yellow-500 py-1 text-center text-black">Подарок скрыт</div>
				)}
			</div>

			{isAdmin && (
				<div className="absolute top-2 right-2 z-20">
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button variant="secondary" size="icon" className="h-8 w-8">
								<EllipsisVerticalIcon className="h-5 w-5 rotate-90" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onSelect={handleEditSelect}>Редактировать</DropdownMenuItem>
							<DropdownMenuItem className="text-yellow-500" onClick={() => onHide?.(item)}>
								{item.hidden ? 'Показать' : 'Скрыть'}
							</DropdownMenuItem>
							<DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(item)}>
								Удалить
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)}

			<Card
				className={cn(
					'h-full w-full cursor-pointer bg-wishlist-yellow opacity-100 transition-all',
					item.booked || optimisticUpdate ? 'opacity-50' : 'hover:opacity-70',
					optimisticUpdate ? 'pointer-events-none' : ''
				)}
				onClick={onSelect}
			>
				<CardContent className="flex flex-col p-4">
					<Image
						src={imageUrl}
						alt={item.description}
						width={400}
						height={300}
						className="mb-4 h-[50vw] w-full rounded-lg object-cover object-center md:h-80"
					/>
					<h4 className="mt-auto text-2xl font-semibold text-black">{item.description}</h4>
					<h4 className="mt-1 text-xl text-black">{item.price}₽</h4>
				</CardContent>
			</Card>
		</div>
	)
}
