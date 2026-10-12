import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: {
		'calendar-fault-runtime': 'tools/calendar-fault-runtime.ts',
		'calendar-faults': '../../e2e/support/calendar-faults.ts',
		'calendar-fault-operator': 'tools/calendar-fault-operator.ts',
		'calendar-fault-protocol': '../../e2e/support/calendar-fault-protocol.ts',
	},
	format: 'esm',
	platform: 'node',
	target: 'node24',
	outDir: 'dist',
	sourcemap: true,
	clean: false,
	deps: { alwaysBundle: [/^@dv-lab\//] },
})
