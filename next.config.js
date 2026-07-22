const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

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
      // pptxgenjs imports node:https / node:fs — strip the scheme and stub for browser.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        path: false,
        os: false,
        express: false,
        "image-size": false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
