import path from "node:path";
import { withLogtail } from "@logtail/next";
import { fileURLToPath } from "url";
// const { default: bundleAnalyzer } = await import('@next/bundle-analyzer');

// const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

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
    // If process.cwd() ends with "packages/ui", assume repository root is one level up.
    const repoRoot = process.cwd().endsWith("packages/ui")
      ? path.join(process.cwd(), "..")
      : process.cwd();
    config.resolve.alias = {
      ...config.resolve.alias,
      '@dex-example/lib': path.join(repoRoot, "packages", "lib"),
      'o1js': false,
    };
    return config;
  },
};

export default withLogtail(nextConfig);
