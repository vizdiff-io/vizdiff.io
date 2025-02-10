// In dev mode, proxy API requests to the API server. In production, export the
// app as static HTML/CSS/JS files

const isDev = process.env.NODE_ENV !== "production"

/** @type {import('next').NextConfig} */
const nextConfigDev = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`, // Proxy to API server
      },
    ]
  },
}

/** @type {import('next').NextConfig} */
const nextConfigDeploy = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  output: "export",
  exportPathMap: async function (defaultPathMap) {
    return {
      ...defaultPathMap,
    }
  },
}

module.exports = isDev ? nextConfigDev : nextConfigDeploy
