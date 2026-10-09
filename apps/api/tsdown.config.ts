import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: {
		migrate: 'src/migrate.ts',
		server: 'src/server.ts',
		'bootstrap-teacher': 'src/bootstrap-teacher.ts',
		'import-vault': 'src/import-vault.ts',
	},
	format: 'esm',
	platform: 'node',
	target: 'node24',
	outDir: 'dist',
	sourcemap: true,
	clean: ['dist', 'drizzle'],
	deps: { alwaysBundle: [/^@dv-lab\//] },
	copy: [{ from: '../../packages/db/drizzle', to: '.' }],
})
