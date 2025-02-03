'use client'

import { useState } from 'react'

export default function UploaderPage() {
	const [uploading, setUploading] = useState(false)

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		setUploading(true)

		try {
			const formData = new FormData()
			formData.append('file', file)
			formData.append('filename', `${file.name.split('.').pop()}`)

			await fetch('/api/upload', {
				method: 'POST',
				body: formData,
			})
		} finally {
			setUploading(false)
		}
	}

	return (
		<div>
			<input
				type='file'
				onChange={handleUpload}
				disabled={uploading}
				accept='image/*'
			/>
			{uploading && <p>Uploading...</p>}
		</div>
	)
}
