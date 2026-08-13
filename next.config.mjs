import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
    experimental: {
      
      serverActions: {
        bodySizeLimit: "100mb",
        allowedOrigins: ['smartcardio.ru', 'www.smartcardio.ru', 'localhost:3000']
      }
    },

    
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // Uploaded files land in `media/` inside the project root. Without this,
    // every upload touches a watched path, the dev server starts recompiling
    // and the NEXT in-flight request gets dropped — which the browser reports
    // as a bare "TypeError: Failed to fetch" with nothing in the server log.
    webpackConfig.watchOptions = {
      ...webpackConfig.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/media/**',
        '**/mediasoup-recordings/**',
        '**/logs/**',
      ],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
