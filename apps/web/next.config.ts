import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const nextConfig: NextConfig = {
	output: 'standalone',
	outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
	poweredByHeader: false,
	rewrites: async () => {
		const target = process.env.API_DEV_PROXY_URL
		if (process.env.NODE_ENV !== 'development' || !target) return []
		return [{ source: '/api/:path*', destination: `${target}/:path*` }]
	},
}

export default nextConfig
