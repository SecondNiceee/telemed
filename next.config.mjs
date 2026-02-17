import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  basePath : process.env.NEXT_PUBLIC_BASE_PATH || "/telemed-dev",
    experimental: {
      
      serverActions: {
        bodySizeLimit: '2mb',
        allowedOrigins: ['smartcardio.ru', 'www.smartcardio.ru', 'localhost:3000']
      }
    },
  
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
