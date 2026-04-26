import type { NextConfig } from 'next'

function apiOrigin() {
	return (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')
}

const nextConfig: NextConfig = {
	transpilePackages: ['@teacher-crm/api-types', '@teacher-crm/rbac'],
	async rewrites() {
		const origin = apiOrigin()

		return {
			beforeFiles: [{ source: '/api/:path*', destination: `${origin}/:path*` }],
			afterFiles: [],
			fallback: [],
		}
	},
}

export default nextConfig
