export interface Item {
	id: string
	description: string
	price: number
	href: string
	booked: boolean
	hidden: boolean
	image_url: string | null
	created_at?: Date | null
	image?: File
}
