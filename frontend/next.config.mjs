// In dev mode, proxy API requests to the API server. In production, export the
// app as static HTML/CSS/JS files

import { execSync } from "child_process"

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
  generateBuildId: async () => {
    const gitHash = process.env.GIT_HASH ?? execSync("git rev-parse HEAD").toString().trim()
    if (gitHash.length !== 40) {
      throw new Error(`Invalid git hash: "${gitHash}"`)
    }
    return gitHash.slice(0, 20)
  },
  output: "export",
  exportPathMap: async function (defaultPathMap) {
    return {
      ...defaultPathMap,
    }
  },
}

export default isDev ? nextConfigDev : nextConfigDeploy
