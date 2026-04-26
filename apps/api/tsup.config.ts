import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts', 'src/local-server.ts'],
	format: ['esm'],
	platform: 'node',
	outDir: 'dist',
	sourcemap: true,
	clean: true,
	noExternal: [/^@teacher-crm\//],
})
