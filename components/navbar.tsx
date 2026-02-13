'use client'

import { useState } from 'react'

import { Menu } from 'lucide-react'
import NextLink from 'next/link'

import { Logo, ProfileIcon } from '@/components/icons'
// import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { siteConfig } from '@/config/site'

export const Navbar = () => {
	const [open, setOpen] = useState(false)

	return (
		<header className="fixed top-0 right-0 left-0 z-50 border-b bg-background/10 backdrop-blur-md">
			<nav className="mx-auto flex h-14 items-center justify-between px-4">
				<div className="flex items-center gap-4">
					<NextLink className="flex items-center gap-1" href="/">
						<Logo />
					</NextLink>
					<ul className="hidden gap-4 sm:flex">
						{siteConfig.navItems.map((item) => (
							<li key={item.href}>
								<NextLink className="text-foreground transition-colors hover:text-primary" href={item.href}>
									{item.label}
								</NextLink>
							</li>
						))}
					</ul>
				</div>

				<div className="hidden items-center gap-2 sm:flex">
					<NextLink href="/profile" className="text-foreground hover:text-primary">
						<ProfileIcon size={22} />
					</NextLink>
					{/* <ThemeSwitch /> */}
				</div>

				<div className="flex items-center gap-2 sm:hidden">
					<NextLink href="/profile" className="text-foreground hover:text-primary">
						<ProfileIcon size={22} />
					</NextLink>
					{/* <ThemeSwitch /> */}
					<Sheet open={open} onOpenChange={setOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon">
								<Menu className="h-5 w-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-64">
							<nav className="mt-8 flex flex-col gap-4">
								{siteConfig.navMenuItems.map((item, index) => (
									<NextLink
										key={`${item.href}-${index}`}
										href={item.href}
										className="text-lg text-foreground transition-colors hover:text-primary"
										onClick={() => setOpen(false)}
									>
										{item.label}
									</NextLink>
								))}
							</nav>
						</SheetContent>
					</Sheet>
				</div>
			</nav>
		</header>
	)
}
