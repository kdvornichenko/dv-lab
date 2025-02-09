export interface Item {
    id: string
    price: number
    description: string
    href: string
    booked?: boolean
    image?: File
    hidden?: boolean
}


export interface BlobObject {
    url: string
    pathname: string
} 