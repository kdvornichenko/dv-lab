import { Loader2 } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Item } from '@/types/wishlist.types'

interface BookingModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	selectedItem: Item | null
	optimisticUpdate: string | null
	onBook: () => Promise<void>
}

export function BookingModal({ isOpen, onOpenChange, selectedItem, optimisticUpdate, onBook }: BookingModalProps) {
	if (!selectedItem) return null

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="bg-wishlist-yellow text-black">
				<DialogHeader>
					<DialogTitle>{selectedItem.description}</DialogTitle>
				</DialogHeader>
				<div>
					<p className="mb-2 text-lg font-semibold">Цена: {selectedItem.price}₽</p>
					{selectedItem.booked && (
						<p>
							Если решили отменить бронирование, то напишите{' '}
							<Link href="https://t.me/mercyyy813" className="text-blue-500 transition-colors hover:text-blue-500/50">
								@mercyyy813
							</Link>
						</p>
					)}
				</div>
				<DialogFooter className="flex flex-col gap-2 sm:flex-col">
					<div className="flex items-center gap-x-2">
						<Button
							className="w-full cursor-pointer bg-wishlist-pink hover:bg-wishlist-peach"
							variant={selectedItem.booked ? 'default' : 'secondary'}
							onClick={onBook}
							disabled={selectedItem.booked || !!optimisticUpdate}
						>
							{optimisticUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{optimisticUpdate ? 'Обработка...' : selectedItem.booked ? 'Уже забронирован' : 'Забронировать'}
						</Button>
						<Button className="w-full" variant="outline" asChild>
							<Link
								href={selectedItem.href}
								target="_blank"
								className="bg-white hover:bg-wishlist-yellow-light hover:text-black"
							>
								Где купить?
							</Link>
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
