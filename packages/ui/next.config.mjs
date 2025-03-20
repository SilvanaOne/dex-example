import path from "node:path";
import { withLogtail } from "@logtail/next";
import transpileModules from "next-transpile-modules";
import { fileURLToPath } from "url";

// Set up next-transpile-modules for @dex-example/lib
//const withTM = transpileModules(["@dex-example/lib"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oaidalleapiprodscus.blob.core.windows.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*",
        port: "",
        pathname: "/**",
      },
    ],
  },
  reactStrictMode: true,
  webpack(config, { buildId, dev, isServer, defaultLoaders, webpack }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "o1js": false,
      "@dex-example/lib": path.join(__dirname, "..", "lib"),
    };
    return config;
  },
};

export default withLogtail(nextConfig);