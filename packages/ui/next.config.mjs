import path from "node:path";
import { withLogtail } from "@logtail/next";
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
  headers: async () => {
    return [
      {
        source: "/(.*)",

        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
    ];
  },

  webpack(config, { buildId, dev, isServer, defaultLoaders, webpack }) {
    if (isServer === false) {
      config.resolve.alias = {
        ...config.resolve.alias,
        o1js: path.resolve(__dirname, "node_modules/o1js/dist/web/index.js"),
        "@dex-example/lib": path.join(__dirname, "..", "lib"),
      };
      //config.optimization.minimizer = [];
    } else {
      config.externals.push("o1js"); // https://nextjs.org/docs/app/api-reference/next-config-js/serverExternalPackages
      config.resolve.alias = {
        ...config.resolve.alias,
        "@dex-example/lib": path.join(__dirname, "..", "lib"),
      };
    }
    return config;
  },
  // webpack(config, { buildId, dev, isServer, defaultLoaders, webpack }) {
  //   config.resolve.alias = {
  //     ...config.resolve.alias,
  //     "o1js": false,
  //     "@dex-example/lib": path.join(__dirname, "..", "lib"),
  //   };
  //   return config;
  // },
};

export default withLogtail(nextConfig);