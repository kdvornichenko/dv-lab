import { Item } from '@/types/wishlist.types'
import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	Button,
	Input,
} from '@nextui-org/react'
import { useState, useEffect } from 'react'

interface AdminEditModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	selectedItem: Item | null
	onEditItem: (item: Item) => Promise<void>
	isNew?: boolean
}

export function AdminEditModal({
	isOpen,
	onOpenChange,
	selectedItem,
	onEditItem,
	isNew,
}: AdminEditModalProps) {
	const [editingItem, setEditingItem] = useState<Item | null>(selectedItem)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)

	useEffect(() => {
		setEditingItem(selectedItem)
	}, [selectedItem])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!editingItem) return

		try {
			await onEditItem({
				...editingItem,
				image: selectedFile || undefined,
			})
			setSelectedFile(null)
			onOpenChange(false)
		} catch (error) {
			console.error('Ошибка при редактировании:', error)
		}
	}

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange} size='md'>
			<ModalContent>
				<ModalHeader>{isNew ? 'Добавить подарок' : 'Редактировать подарок'}</ModalHeader>
				<ModalBody className='gap-4 pb-6'>
					{editingItem && (
						<form onSubmit={handleSubmit} className='space-y-4'>
							<Input
								label='Описание'
								value={editingItem.description}
								onChange={e =>
									setEditingItem({
										...editingItem,
										description: e.target.value,
									})
								}
							/>
							<Input
								type='number'
								label='Цена'
								value={editingItem.price.toString()}
								onChange={e =>
									setEditingItem({
										...editingItem,
										price: parseInt(e.target.value) || 0,
									})
								}
							/>
							<Input
								label='Ссылка'
								value={editingItem.href}
								onChange={e =>
									setEditingItem({ ...editingItem, href: e.target.value })
								}
							/>
							<input
								type='file'
								accept='image/*'
								onChange={e =>
									setSelectedFile(e.target.files ? e.target.files[0] : null)
								}
							/>
							<div className='flex gap-2'>
								<Button type='submit' color='primary'>
									{isNew ? 'Добавить' : 'Сохранить'}
								</Button>
								<Button
									color='danger'
									variant='light'
									onPress={() => onOpenChange(false)}
								>
									Отмена
								</Button>
							</div>
						</form>
					)}
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}
