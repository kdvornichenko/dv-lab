import { Item } from '@/types/wishlist.types'
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import {
	Dropdown,
	DropdownTrigger,
	DropdownMenu,
	DropdownItem,
} from '@heroui/dropdown'
import { Button } from '@heroui/button'
import { Card, CardBody } from '@heroui/card'
import { Image } from '@nextui-org/image'

interface GiftCardProps {
	item: Item
	imageUrl: string

	optimisticUpdate?: string | null
	onSelect?: () => void
	onEdit?: (item: Item) => void
	onDelete?: (item: Item) => void
	isAdmin?: boolean
}

export function GiftCard({
	item,
	imageUrl,
	optimisticUpdate,
	onSelect,
	onEdit,
	onDelete,
	isAdmin,
}: GiftCardProps) {
	return (
		<div className='relative'>
			{(item.booked || optimisticUpdate === item.id) && (
				<div className='absolute top-2 left-2 right-2 bg-red-500 text-white text-center py-1 rounded-lg z-10'>
					Подарок забронирован
				</div>
			)}

			{isAdmin && (
				<div className='absolute top-2 right-2 z-20'>
					<Dropdown>
						<DropdownTrigger>
							<Button
								isIconOnly
								variant='faded'
								size='sm'
								className='min-w-unit-8 w-unit-8 h-unit-8'
							>
								<EllipsisVerticalIcon className='h-5 w-5 rotate-90' />
							</Button>
						</DropdownTrigger>
						<DropdownMenu

							aria-label='Gift actions'
							onAction={key => {
								if (key === 'edit') onEdit?.(item)
								if (key === 'delete') onDelete?.(item)
							}}
						>
							<DropdownItem key='edit'>Редактировать</DropdownItem>
							<DropdownItem key='delete' className='text-danger' color='danger'>
								Удалить
							</DropdownItem>
						</DropdownMenu>
					</Dropdown>
				</div>
			)}

			<Card
				isPressable={!optimisticUpdate}
				className={`h-full w-full transition-all opacity-100 ${
					item.booked || optimisticUpdate ? 'opacity-50' : 'hover:opacity-70'
				}`}
				onPress={onSelect}
			>
				<CardBody className='p-4 flex flex-col'>
					<Image
						src={imageUrl}
						alt={item.description}
						width={'100%'}
						className='rounded-lg object-cover mb-4 h-[50vw] md:h-52 w-full'
					/>
					<h4 className='mt-auto font-semibold'>{item.description}</h4>
					<h4 className='mt-1 text-md text-gray-400/50'>{item.price}₽</h4>
				</CardBody>
			</Card>
		</div>
	)
}
