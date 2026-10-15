import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true },
			],
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{ name: 'cmdk', message: 'cmdk is forbidden: it depends on Radix.' },
						{ name: 'radix-ui', message: 'Radix is forbidden: use Base UI.' },
						{ name: 'cn', message: 'Import cn from @/lib/utils.' },
						{
							name: 'motion/react',
							importNames: ['motion'],
							message: 'Use m from motion/react: the app runs under LazyMotion (components/app/motion-features.tsx).',
						},
						{ name: 'framer-motion', message: 'Import from motion/react.' },
					],
					patterns: [{ group: ['@radix-ui/*'], message: 'Radix is forbidden: use Base UI.' }],
				},
			],
		},
	},
	globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
])

export default eslintConfig
