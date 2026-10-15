import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const nextConfig: NextConfig = {
	cacheComponents: true,
	partialPrefetching: true,
	experimental: { staleTimes: { dynamic: 300 } },
	output: 'standalone',
	outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
	poweredByHeader: false,
	headers: async () => [
		{
			source: '/sw.js',
			headers: [
				{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
				{ key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
			],
		},
	],
	rewrites: async () => {
		const target = process.env.API_DEV_PROXY_URL
		if (process.env.NODE_ENV !== 'development' || !target) return []
		return [{ source: '/api/:path*', destination: `${target}/:path*` }]
	},
}

export default nextConfig
