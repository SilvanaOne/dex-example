import path from "node:path";
import { withLogtail } from "@logtail/next";
import transpileModules from "next-transpile-modules";
import { fileURLToPath } from "url";

// Set up next-transpile-modules for @dex-example/lib
const withTM = transpileModules(["@dex-example/lib"]);

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
    // Optional: Add an alias if needed. If your workspace is structured so that the files are not in node_modules,
    // this alias helps resolve the location. Adjust as necessary.
    const repoRoot = process.cwd().endsWith("packages/ui")
      ? path.join(process.cwd(), "..")
      : process.cwd();
    config.resolve.alias = {
      ...config.resolve.alias,
      "@dex-example/lib": path.join(repoRoot, "packages", "lib"),
      // Optionally disable large libraries that you don't need:
      "o1js": false,
    };
    return config;
  },
};

export default withTM(withLogtail(nextConfig));