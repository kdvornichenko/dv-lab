import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	outDir: 'dist',
	clean: true,
	dts: {
		compilerOptions: {
			baseUrl: '../..',
			rootDir: '../..',
			paths: {
				'@teacher-crm/rbac': ['packages/rbac/src/index.ts'],
			},
		},
	},
})
