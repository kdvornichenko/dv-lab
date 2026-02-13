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
	optimisticUpdate?: string | null
	onSelect?: () => void
	onEdit?: (item: Item) => void
	onDelete?: (item: Item) => void
	onHide?: (item: Item) => void
	isAdmin?: boolean
}

export function GiftCard({
	item,
	optimisticUpdate,
	onSelect,
	onEdit,
	onDelete,
	onHide,
	isAdmin,
}: GiftCardProps) {
	const imageUrl = item.image_url || '/img/placeholder.jpg'

	return item.hidden && !isAdmin ? null : (
		<div className='relative'>
			<div className='absolute top-2 left-2 right-2 z-20 flex flex-col gap-2'>
				{(item.booked || (optimisticUpdate === item.id && !item.hidden)) && (
					<div className='bg-success-500 text-white text-center py-1 rounded-lg '>
						Подарок забронирован
					</div>
				)}

				{isAdmin && item.hidden && (
					<div className='bg-warning-500 text-black text-center py-1 rounded-lg'>
						Подарок скрыт
					</div>
				)}
			</div>

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
								if (key === 'hide') onHide?.(item)
							}}
						>
							<DropdownItem key='edit'>Редактировать</DropdownItem>
							<DropdownItem key='hide' className='text-warning' color='warning'>
								{item.hidden ? 'Показать' : 'Скрыть'}
							</DropdownItem>
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
