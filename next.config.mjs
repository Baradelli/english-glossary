/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only emit the self-contained server (`.next/standalone/server.js`) when the
  // desktop build asks for it (NEXT_OUTPUT=standalone). Unset → dev/build/start
  // behave exactly as before. See scripts/desktop-build.mjs.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  reactStrictMode: true,
  webpack: (config) => {
    // Resolve NodeNext-style ".js" import specifiers to their ".ts"/".tsx"
    // sources (the domain/infra/application layers use explicit .js endings).
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
