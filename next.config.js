const path = require("path");
const fs = require("fs");

// Monorepo node_modules (when run via npm workspace from root, cwd is root)
const rootNm = path.join(process.cwd(), "node_modules");
const appNm = path.join(__dirname, "../../node_modules");
const nodeModules = fs.existsSync(path.join(rootNm, "react")) ? rootNm : appNm;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "react-icons",
    "@react-three/fiber",
    "@react-three/drei",
    "three",
  ],
  output: "standalone",
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Only alias React on the client so @react-three/fiber sees one React (fixes ReactCurrentOwner).
    // Server must use default resolution so Next.js gets React 19 with cache() (fixes "cache is not a function").
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.join(nodeModules, "react"),
        "react-dom": path.join(nodeModules, "react-dom"),
        "react-dom/client": path.join(nodeModules, "react-dom/client"),
      };
      config.resolve.modules = [nodeModules, ...(config.resolve.modules || [])];
    }
    return config;
  },
};

module.exports = nextConfig;
