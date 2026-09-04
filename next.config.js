const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare')

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'"
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
]

module.exports = {
  reactStrictMode: true,
  experimental: {
    cpus: 1,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

initOpenNextCloudflareForDev()
