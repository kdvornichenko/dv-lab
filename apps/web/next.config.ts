import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	transpilePackages: ['@teacher-crm/api-types', '@teacher-crm/rbac'],
}

export default nextConfig
