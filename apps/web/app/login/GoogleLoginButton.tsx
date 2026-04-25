import { LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function GoogleLoginButton() {
	return (
		<Button asChild className="w-full">
			<a href="/auth/sign-in?next=/">
				<LogIn className="h-4 w-4" />
				Continue with Google
			</a>
		</Button>
	)
}
