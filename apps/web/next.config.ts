import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	transpilePackages: ['@teacher-crm/api', '@teacher-crm/api-types', '@teacher-crm/rbac', '@teacher-crm/db'],
	allowedDevOrigins: ['web.teacher-crm.localhost'],
}

export default nextConfig
