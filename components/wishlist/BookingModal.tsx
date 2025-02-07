import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import Link from 'next/link'
import { Item } from '@/types/wishlist.types'

interface BookingModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    selectedItem: Item | null
    optimisticUpdate: string | null
    onBook: () => Promise<void>
}

export function BookingModal({
    isOpen,
    onOpenChange,
    selectedItem,
    optimisticUpdate,
    onBook
}: BookingModalProps) {
    if (!selectedItem) return null

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    {selectedItem.description}
                </ModalHeader>
                <ModalBody>
                    <p className="text-lg font-semibold mb-2">Цена: {selectedItem.price}₽</p>
                    {selectedItem.booked ? (
                        <p>Если решили отменить бронирование, то напишите Кириллу</p>
                    ) : (
                        <p>
                            Вы можете посмотреть подарок{' '}
                            <Link
                                href={selectedItem.href}
                                target="_blank"
                                className="text-blue-500 hover:underline"
                            >
                                по ссылке
                            </Link>
                        </p>
                    )}
                </ModalBody>
                <ModalFooter className="flex flex-col gap-2">
                    <div className="flex items-center gap-x-2">
                        <Button
                            fullWidth
                            color={selectedItem.booked ? 'primary' : 'warning'}
                            onPress={onBook}
                            isDisabled={selectedItem.booked || !!optimisticUpdate}
                            isLoading={!!optimisticUpdate}
                        >
                            {optimisticUpdate
                                ? 'Обработка...'
                                : selectedItem.booked
                                ? 'Уже забронирован'
                                : 'Забронировать'}
                        </Button>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
} 