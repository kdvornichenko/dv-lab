import nextPlugin from '@next/eslint-plugin-next'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

import reactHooksPlugin from 'eslint-plugin-react-hooks'

const config = [
	{
		ignores: [
			'.now/',
			'*.css',
			'.changeset',
			'dist/',
			'esm/',
			'public/',
			'tests/',
			'scripts/',
			'*.config.js',
			'.DS_Store',
			'node_modules/',
			'coverage/',
			'.next/',
			'build/',
			'next-env.d.ts',
		],
	},

	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		plugins: {
			'@next/next': nextPlugin,
			'@typescript-eslint': tsPlugin,
			'react-hooks': reactHooksPlugin,
		},
		rules: {
			...nextPlugin.configs.recommended.rules,
			...nextPlugin.configs['core-web-vitals'].rules,
			...reactHooksPlugin.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
		},
	},
]

export default config
