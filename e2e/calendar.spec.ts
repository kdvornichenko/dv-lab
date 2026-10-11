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
