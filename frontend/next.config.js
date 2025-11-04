/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@rainbow-me/rainbowkit', '@wagmi/core'],
  webpack: (config, { isServer }) => {
    // Ignore React Native dependencies that aren't needed for web builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;


