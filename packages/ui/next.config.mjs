import path from "node:path";
import { withLogtail } from "@logtail/next";
import { fileURLToPath } from "url";
const { default: bundleAnalyzer } = await import('@next/bundle-analyzer');

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

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
        '@dex-example/lib' : path.join(__dirname, '..', 'lib'),
        'o1js': false,
      };
    return config;
  },
};

export default withBundleAnalyzer(withLogtail(nextConfig));
