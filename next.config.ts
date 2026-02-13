import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	reactCompiler: true,
	experimental: {
		scrollRestoration: true,
		turbopackFileSystemCacheForDev: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
				pathname: '**',
			},
			{
				protocol: 'https',
				hostname: '*.supabase.co',
				pathname: '/storage/v1/object/public/**',
			},
		],
	},
}

export default nextConfig
