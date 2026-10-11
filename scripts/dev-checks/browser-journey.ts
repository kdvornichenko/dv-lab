import { launch } from './browser-context.ts'

type Options = Parameters<typeof launch>[0]
type Session = Awaited<ReturnType<typeof launch>>

export async function withBrowser(
	options: Options,
	run: (session: Session) => Promise<void>,
	...cleanup: (() => void)[]
): Promise<void> {
	let session: Session | undefined
	const errors: unknown[] = []
	try {
		session = await launch(options)
		await run(session)
	} catch (error) {
		errors.push(error)
	} finally {
		try {
			await session?.browser.close()
		} catch (error) {
			errors.push(error)
		} finally {
			for (const finish of cleanup) {
				try {
					finish()
				} catch (error) {
					errors.push(error)
				}
			}
		}
	}
	if (errors.length === 1) throw errors[0]
	if (errors.length > 1) throw new AggregateError(errors, 'Browser journey finalization failed')
}
