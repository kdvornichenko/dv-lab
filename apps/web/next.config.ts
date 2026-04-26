import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	transpilePackages: ['@teacher-crm/api-types', '@teacher-crm/rbac', '@teacher-crm/db'],
}

export default nextConfig
