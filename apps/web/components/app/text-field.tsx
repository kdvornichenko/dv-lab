'use client'

import { useState, type ComponentProps, type ReactNode } from 'react'

import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, 'id'> {
	id: string
	label: string
	helper?: string
	error?: string
	trailing?: ReactNode
}

export function TextField({ id, label, helper, error, trailing, className, ...props }: TextFieldProps) {
	const errorId = `${id}-error`
	const helperId = `${id}-helper`
	const describedBy = error ? errorId : helper ? helperId : undefined
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor={id} className="text-body text-muted-foreground">
				{label}
			</label>
			<div className="relative">
				<Input
					id={id}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					className={cn(trailing ? 'pr-10' : undefined, className)}
					{...props}
				/>
				{trailing ? <div className="absolute top-1 right-1">{trailing}</div> : null}
			</div>
			{error ? (
				<p id={errorId} className="text-caption text-destructive">
					{error}
				</p>
			) : helper ? (
				<p id={helperId} className="text-caption text-muted-foreground">
					{helper}
				</p>
			) : null}
		</div>
	)
}

export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
	const [visible, setVisible] = useState(false)
	return (
		<TextField
			{...props}
			type={visible ? 'text' : 'password'}
			trailing={
				<Button
					type="button"
					variant="ghost"
					size="icon-compact"
					aria-label={visible ? 'Hide password' : 'Show password'}
					aria-pressed={visible}
					onClick={() => setVisible((value) => !value)}
				>
					{visible ? <EyeOff /> : <Eye />}
				</Button>
			}
		/>
	)
}
