'use client'

import supabase from '@/libs/supabase/supabaseClient'
import { User } from '@/types/supabase.types'
import { User as SupabaseUser } from '@supabase/supabase-js'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, Card, Input, Avatar } from '@nextui-org/react'

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
				.then(user => {
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
			const { error } = await supabase
				.from('users')
				.update({ name: formData.name })
				.eq('uid', profile?.uid)

			if (error) throw error

			setProfile(prev => prev && { ...prev, name: formData.name })
			setEditing(false)

			// Обновляем токен сессии
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
		setFormData(prev => ({ ...prev, [name]: value }))
	}

	return (
		<div className='flex items-center justify-center min-h-screenpx-4 py-6'>
			<Card className='p-4'>
				{loading ? (
					<div className='flex justify-center items-center'>Загрузка...</div>
				) : profile ? (
					<div className='flex flex-col items-center space-y-4'>
						{/* Аватар */}
						{profile.avatar ? (
							<Avatar src={profile.avatar} size='lg' color='primary' />
						) : (
							<Avatar size='lg' color='primary' />
						)}

						{/* Имя пользователя */}
						{editing ? (
							<div className='w-full flex flex-col gap-y-2'>
								<Input
									fullWidth
									label='Имя'
									placeholder='Введите имя'
									name='name'
									value={formData.name}
									onChange={handleInputChange}
									variant='bordered'
								/>
								<div className='flex justify-center gap-x-2'>
									<Button color='success' onPressEnd={handleSaveClick}>
										Сохранить
									</Button>
									<Button color='danger' onPressEnd={() => setEditing(false)}>
										Отмена
									</Button>
								</div>
							</div>
						) : (
							<>
								<p className='text-xl font-semibold'>{profile.name}</p>
								<Button variant='bordered' onPressEnd={handleEditClick}>
									Редактировать профиль
								</Button>
							</>
						)}

						{/* Кнопка выхода */}
						{!editing && (
							<Button
								color='danger'
								onPressEnd={async () => {
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
					<p className='text-center text-gray-500'>Профиль не найден</p>
				)}
			</Card>
		</div>
	)
}
