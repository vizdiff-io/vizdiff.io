/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  exportPathMap: async function (defaultPathMap) {
    return {
      ...defaultPathMap,
    }
  },
}

module.exports = nextConfig
