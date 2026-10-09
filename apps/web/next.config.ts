import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const nextConfig: NextConfig = {
	output: 'standalone',
	outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
	poweredByHeader: false,
}

export default nextConfig
