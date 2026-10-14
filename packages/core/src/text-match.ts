export function titleText(value: string): string {
	return value
		.normalize('NFKC')
		.replace(/[\u200B-\u200D\u2060\u00AD]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

const LOOKALIKES: Record<string, string> = {
	a: 'а',
	b: 'в',
	c: 'с',
	e: 'е',
	h: 'н',
	k: 'к',
	m: 'м',
	o: 'о',
	p: 'р',
	t: 'т',
	x: 'х',
	y: 'у',
	ё: 'е',
}

export function titleKey(value: string): string {
	return titleText(value)
		.toLocaleLowerCase()
		.replace(/[abcehkmoptxyё]/g, (letter) => LOOKALIKES[letter] ?? letter)
}

export function nameMatches(name: string, query: string): boolean {
	return titleKey(name).includes(titleKey(query))
}
