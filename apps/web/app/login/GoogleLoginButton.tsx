import { Button } from '@/components/ui/button'

export function GoogleLoginButton() {
	return (
		<Button asChild className="w-full">
			<a href="/auth/sign-in?next=/">Continue with Google</a>
		</Button>
	)
}
