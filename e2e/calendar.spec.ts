import { expect, test } from './support/test.ts'

test.use({ storageState: { cookies: [], origins: [] } })

test('[calendar] public pages keep the workspace private', async ({ page }) => {
	const response = await page.goto('/welcome')
	expect(response?.status()).toBe(200)
	await expect(page.getByRole('heading', { level: 1, name: 'dv-lab', exact: true })).toBeVisible()
	await expect(
		page.getByText('A private workspace for managing lessons, student records and lesson payments.')
	).toBeVisible()
	await page.keyboard.press('Tab')
	await expect(page.getByRole('navigation').getByRole('link', { name: 'dv-lab', exact: true })).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign in', exact: true })).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(page).toHaveURL(/\/login$/)
	for (const path of ['/', '/settings', '/welcome/private', '/privacy-extra', '/terms/private']) {
		await page.goto(path)
		await expect(page).toHaveURL(/\/login$/)
	}
})

test('[calendar] public policies describe calendar storage and recovery', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 })
	for (const [path, title] of [
		['/welcome', 'dv-lab'],
		['/privacy', 'Privacy policy'],
		['/terms', 'Terms'],
	] as const) {
		const response = await page.goto(path)
		expect(response?.status()).toBe(200)
		await expect(page).toHaveURL(new RegExp(`${path}$`))
		await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
		for (const [name, destination] of [
			['Home', '/welcome'],
			['Privacy policy', '/privacy'],
			['Terms', '/terms'],
		] as const) {
			const link = page.getByRole('contentinfo').getByRole('link', { name, exact: true })
			await expect(link).toHaveAttribute('href', destination)
			await link.focus()
			await page.keyboard.press('Enter')
			await expect(page).toHaveURL(new RegExp(`${destination}$`))
			await page.goto(path)
		}
	}
	await page.goto('/privacy')
	for (const section of [
		'Calendar access',
		'Information sent to Google',
		'Calendar information read and stored',
		'Calendar view metadata',
		'Last checked view and retention',
		'Connection and request records',
		'Local teaching records',
		'Form recovery',
		'Authorization',
		'Data recipients',
		'Operational records',
		'Disconnecting',
		'Refreshing the view',
	])
		await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible()
	for (const disclosure of [
		'This feature does not automatically delete the cache or history after a fixed period.',
		'Access and refresh tokens are not sent to the browser.',
		'Unsaved form inputs stay only in the memory of the open tab.',
		'Your local history, existing Google events, last checked view, links and request records are kept.',
	])
		await expect(page.getByText(disclosure, { exact: false })).toBeVisible()
	await page.goto('/terms')
	await expect(page.getByText('A pending or unknown result is not a saved change.', { exact: false })).toBeVisible()
	await expect(page.getByText('New offline calendar changes are not accepted.', { exact: false })).toBeVisible()
	await page.getByRole('main').getByRole('link', { name: 'Privacy policy', exact: true }).click()
	await expect(page).toHaveURL(/\/privacy$/)
})
