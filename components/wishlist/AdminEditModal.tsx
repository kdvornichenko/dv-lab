import { useEffect, useRef, useState, type ComponentProps } from 'react'

import { ImageIcon, Upload } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Item } from '@/types/wishlist.types'

interface AdminEditModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	selectedItem: Item | null
	onEditItem: (item: Item) => Promise<void>
	isNew?: boolean
}

export function AdminEditModal({ isOpen, onOpenChange, selectedItem, onEditItem, isNew }: AdminEditModalProps) {
	const [editingItem, setEditingItem] = useState<Item | null>(selectedItem)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (!isOpen) return

		setEditingItem(selectedItem)
		setSelectedFile(null)
	}, [isOpen, selectedItem])

	useEffect(() => {
		if (!selectedFile) {
			setPreviewUrl(null)
			return
		}

		const objectUrl = URL.createObjectURL(selectedFile)
		setPreviewUrl(objectUrl)

		return () => URL.revokeObjectURL(objectUrl)
	}, [selectedFile])

	const handleSubmit: NonNullable<ComponentProps<'form'>['onSubmit']> = async (e) => {
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

	const title = isNew ? 'Добавить подарок' : 'Редактировать подарок'
	const submitText = isNew ? 'Добавить' : 'Сохранить'

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="bg-wishlist-yellow text-black">
				<DialogHeader className="text-black">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div className="gap-4 pb-2">
					{editingItem && (
						<form onSubmit={handleSubmit} className="space-y-4">
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="wishlist-description">Описание</FieldLabel>
									<FieldContent>
										<Input
											id="wishlist-description"
											className="bg-white placeholder:text-black/80"
											placeholder="Описание"
											value={editingItem.description}
											onChange={(e) =>
												setEditingItem({
													...editingItem,
													description: e.target.value,
												})
											}
										/>
									</FieldContent>
								</Field>

								<Field>
									<FieldLabel htmlFor="wishlist-price">Цена</FieldLabel>
									<FieldContent>
										<Input
											id="wishlist-price"
											className="bg-white placeholder:text-black/80"
											type="number"
											min={0}
											placeholder="Цена"
											value={editingItem.price.toString()}
											onChange={(e) =>
												setEditingItem({
													...editingItem,
													price: parseInt(e.target.value, 10) || 0,
												})
											}
										/>
									</FieldContent>
								</Field>

								<Field>
									<FieldLabel htmlFor="wishlist-link">Ссылка</FieldLabel>
									<FieldContent>
										<Input
											id="wishlist-link"
											className="bg-white placeholder:text-black/80"
											placeholder="Ссылка"
											value={editingItem.href}
											onChange={(e) => setEditingItem({ ...editingItem, href: e.target.value })}
										/>
									</FieldContent>
								</Field>

								<Field>
									<FieldLabel htmlFor="wishlist-image">Изображение</FieldLabel>
									<FieldContent>
										<Button
											type="button"
											variant="outline"
											className="w-fit cursor-pointer bg-white hover:bg-wishlist-yellow-light hover:text-black"
											onClick={() => fileInputRef.current?.click()}
										>
											<ImageIcon />
											{selectedFile ? 'Заменить изображение' : 'Выбрать изображение'}
										</Button>
										<Input
											ref={fileInputRef}
											id="wishlist-image"
											type="file"
											accept="image/*"
											hidden
											onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
										/>
										{previewUrl ? (
											<div className="w-fit overflow-hidden rounded-md border border-black/10 bg-white p-1">
												<Image
													src={previewUrl}
													alt="Предпросмотр выбранного изображения"
													width={100}
													height={100}
													className="size-40 rounded object-cover"
												/>
											</div>
										) : (
											<FieldDescription className="text-black/70">Файл не выбран</FieldDescription>
										)}
									</FieldContent>
								</Field>
							</FieldGroup>

							<div className="flex gap-2">
								<Button type="submit">
									<Upload />
									{submitText}
								</Button>
								<Button variant="destructive" type="button" onClick={() => onOpenChange(false)}>
									Отмена
								</Button>
							</div>
						</form>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
