import React, { FC } from 'react'

interface AuthButtonProps {
	onClick: () => void
	isAuthorized: boolean
}

const AuthButton: FC<AuthButtonProps> = ({ onClick, isAuthorized }) => {
	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<button onClick={onClick} className="mb-4 rounded bg-blue-500 px-4 py-2 text-white">
				{isAuthorized ? 'Logout' : 'Authorize'}
			</button>
		</div>
	)
}

export default AuthButton
