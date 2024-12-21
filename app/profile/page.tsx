'use client'

import supabase from '@/libs/supabase/supabaseClient'
import { User } from '@/types/supabase.types'
import { User as SupabaseUser } from '@supabase/supabase-js'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ProfilePage() {
	const [profile, setProfile] = useState<User | null>(null)
	const [sessionUser, setSessionUser] = useState<SupabaseUser | null>(null)
	const [loading, setLoading] = useState(true)
	const [editing, setEditing] = useState(false)
	const [formData, setFormData] = useState({ name: '' })
	const router = useRouter()

	// Проверка сессии на клиентской стороне
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

	// Загрузка профиля после загрузки `sessionUser`
	useEffect(() => {
		if (!sessionUser) return
		const fetchOrCreateProfile = async () => {
			try {
				// Проверяем наличие записи в таблице `users`
				const { data: userData, error: fetchError } = await supabase
					.from('users')
					.select('*')
					.eq('uid', sessionUser.id)
					.single()

				if (fetchError && fetchError.code === 'PGRST116') {
					if (!sessionUser) return

					// Если запись не найдена, создаём новую
					const { error: insertError } = await supabase.from('users').insert({
						uid: sessionUser.id,
						name: sessionUser.user_metadata?.name || '',
						created_at: new Date().toISOString(),
					})
					if (insertError) throw insertError

					// Устанавливаем профиль после создания
					setProfile({
						uid: sessionUser.id,
						name: sessionUser.user_metadata?.name || '',
						created_at: new Date().toISOString(),
					})
				} else if (userData) {
					// Если запись найдена, устанавливаем её
					setProfile(userData)
				} else {
					console.error('Неизвестная ошибка при загрузке профиля')
				}
			} catch (error) {
				console.error('Ошибка при загрузке или создании профиля:', error)
			} finally {
				setLoading(false) // Завершаем загрузку только после завершения всей обработки
			}
		}

		fetchOrCreateProfile()
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
		} catch (error) {
			console.error('Ошибка при сохранении профиля:', error)
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target
		setFormData(prev => ({ ...prev, [name]: value }))
	}

	return (
		<div>
			<h1>Личный кабинет</h1>
			{loading ? (
				<p>Загрузка...</p>
			) : profile ? (
				<div>
					{editing ? (
						<div>
							<label>
								Имя:
								<input
									type='text'
									name='name'
									value={formData.name}
									onChange={handleInputChange}
								/>
							</label>
							<button onClick={handleSaveClick}>Сохранить</button>
							<button onClick={() => setEditing(false)}>Отмена</button>
						</div>
					) : (
						<div>
							<p>Имя: {profile.name}</p>
							<button onClick={handleEditClick}>Редактировать</button>
						</div>
					)}
				</div>
			) : (
				<p>Профиль не найден</p>
			)}
		</div>
	)
}
