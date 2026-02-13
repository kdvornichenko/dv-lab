'use client'

import { User as SupabaseUser } from '@supabase/supabase-js'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import supabase from '@/libs/supabase/supabaseClient'
import { User } from '@/types/supabase.types'

export default function ProfilePage() {
	const [profile, setProfile] = useState<User | null>(null)
	const [sessionUser, setSessionUser] = useState<SupabaseUser | null>(null)
	const [loading, setLoading] = useState(true)
	const [editing, setEditing] = useState(false)
	const [formData, setFormData] = useState({ name: '' })
	const router = useRouter()

	useEffect(() => {
		const checkUser = async () => {
			const {
				data: { session },
				error,
			} = await supabase.auth.getSession()

			if (error || !session) {
				console.error('Ошибка проверки сессии:', error)
				router.push('/login')
				return
			}

			setSessionUser(session.user)
		}

		checkUser()
	}, [router])

	useEffect(() => {
		if (!sessionUser) return

		setLoading(true)

		const fetchUser = async () => {
			await supabase
				.from('users')
				.select('*')
				.eq('uid', sessionUser.id)
				.then((user) => {
					if (user.data?.length === 0) insertUser()
					else setProfile(user.data?.[0])

					setLoading(false)
				})
		}

		const insertUser = async () => {
			await supabase.from('users').insert({
				uid: sessionUser?.id,
				name: sessionUser?.user_metadata?.name || '',
				avatar: sessionUser?.user_metadata?.avatar_url || '',
				created_at: new Date().toISOString(),
			})
		}

		fetchUser()
	}, [sessionUser])

	const handleEditClick = () => {
		setEditing(true)
		setFormData({ name: profile?.name || '' })
	}

	const handleSaveClick = async () => {
		try {
			const { error } = await supabase.from('users').update({ name: formData.name }).eq('uid', profile?.uid)

			if (error) throw error

			setProfile((prev) => prev && { ...prev, name: formData.name })
			setEditing(false)

			const { error: refreshError } = await supabase.auth.refreshSession()
			if (refreshError) {
				console.error('Ошибка обновления токена:', refreshError)
				router.push('/login')
			}
		} catch (error) {
			console.error('Ошибка при сохранении профиля:', error)
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target
		setFormData((prev) => ({ ...prev, [name]: value }))
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4 py-6">
			<Card className="p-4">
				<CardContent>
					{loading ? (
						<div className="flex items-center justify-center">Загрузка...</div>
					) : profile ? (
						<div className="flex flex-col items-center space-y-4">
							<Avatar className="h-16 w-16">
								{profile.avatar ? <AvatarImage src={profile.avatar} alt={profile.name || ''} /> : null}
								<AvatarFallback>{profile.name?.charAt(0) || '?'}</AvatarFallback>
							</Avatar>

							{editing ? (
								<div className="flex w-full flex-col gap-y-2">
									<Input
										className="w-full"
										placeholder="Введите имя"
										name="name"
										value={formData.name}
										onChange={handleInputChange}
									/>
									<div className="flex justify-center gap-x-2">
										<Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleSaveClick}>
											Сохранить
										</Button>
										<Button variant="destructive" onClick={() => setEditing(false)}>
											Отмена
										</Button>
									</div>
								</div>
							) : (
								<>
									<p className="text-xl font-semibold">{profile.name}</p>
									<Button variant="outline" onClick={handleEditClick}>
										Редактировать профиль
									</Button>
								</>
							)}

							{!editing && (
								<Button
									variant="destructive"
									onClick={async () => {
										const { error } = await supabase.auth.signOut()
										if (error) {
											console.error('Ошибка при выходе:', error)
										} else {
											router.push('/login')
										}
									}}
								>
									Выйти
								</Button>
							)}
						</div>
					) : (
						<p className="text-center text-gray-500">Профиль не найден</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
