'use client'

import React, { useState, useEffect } from 'react'
import {
	Card,
	Image,
	CardBody,
	Spinner,
	Button,
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
} from '@nextui-org/react'
import Link from 'next/link'

interface Item {
	id: string
	price: number
	description: string
	href: string
	booked?: boolean
}

interface BlobObject {
	url: string
	pathname: string
}

export default function WishlistPage() {
	const [items, setItems] = useState<Item[]>([])
	const [blobs, setBlobs] = useState<BlobObject[]>([])
	const [selectedItem, setSelectedItem] = useState<Item | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [optimisticUpdate, setOptimisticUpdate] = useState<string | null>(null)

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
			}
		}

		fetchData()
	}, [])

	const handleBookGift = async () => {
		if (!selectedItem) return

		try {
			// Оптимистичное обновление
			setOptimisticUpdate(selectedItem.id)
			setItems(prev =>
				prev.map(item =>
					item.id === selectedItem.id ? { ...item, booked: true } : item
				)
			)

			const response = await fetch('/api/book', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
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

	if (blobs.length === 0 || items.length === 0) {
		return (
			<Spinner className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50' />
		)
	}

	return (
		<div className='p-4'>
			<Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
				<ModalContent>
					<>
						<ModalHeader className='flex flex-col gap-1'>
							{selectedItem?.description}
						</ModalHeader>
						<ModalBody>
							{selectedItem?.booked &&
								'Если решили отменить бронирование, то напишите Кириллу'}
						</ModalBody>
						<ModalFooter className='flex flex-col gap-2'>
							<div className='flex items-center gap-x-2'>
								<Button
									fullWidth
									color={selectedItem?.booked ? 'primary' : 'warning'}
									onPress={handleBookGift}
									isDisabled={selectedItem?.booked || !!optimisticUpdate}
									isLoading={!!optimisticUpdate}
								>
									{optimisticUpdate
										? 'Обработка...'
										: selectedItem?.booked
										? 'Уже забронирован'
										: 'Забронировать'}
								</Button>

								{!selectedItem?.booked && (
									<Button
										fullWidth
										as={Link}
										href={selectedItem?.href}
										target='_blank'
										variant='flat'
										color='default'
										isDisabled={!!optimisticUpdate}
									>
										Где купить?
									</Button>
								)}
							</div>
						</ModalFooter>
					</>
				</ModalContent>
			</Modal>

			<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'>
				{items.map(item => (
					<div key={item.id} className='relative'>
						{(item.booked || optimisticUpdate === item.id) && (
							<div className='absolute top-2 left-2 right-2 bg-red-500 text-white text-center py-1 rounded-lg z-10'>
								Подарок забронирован
							</div>
						)}

						<Card
							isPressable={!item.booked && !optimisticUpdate}
							className={`h-full transition-all opacity-100 ${
								item.booked || optimisticUpdate
									? 'opacity-50'
									: 'hover:opacity-70'
							}`}
							onPress={() => {
								setSelectedItem(item)
								setIsModalOpen(true)
							}}
						>
							<CardBody className='p-4 flex flex-col'>
								<Image
									src={getImageUrl(item.id)}
									alt={item.description}
									width={200}
									height={200}
									className='rounded-lg object-cover mb-4'
								/>
								<h4 className='mt-auto font-semibold'>{item.description}</h4>
								<h4 className='mt-1 text-md text-gray-400/50'>{item.price}₽</h4>
							</CardBody>
						</Card>
					</div>
				))}
			</div>
		</div>
	)
}
