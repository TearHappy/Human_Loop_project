/** @type {import('next').NextConfig} */
const nextConfig = {
	images: { unoptimized: true },

	// Updated for Next.js 15
	serverExternalPackages: [],
	experimental: {
		// Add WebContainer compatibility
		webpackBuildWorker: false,
		// Disable process exit handling that causes issues in WebContainer
		forceSwcTransforms: false,
	},
	// Turbopack config for Next.js 16 (empty config uses defaults)
	turbopack: {},
	// Add custom webpack configuration for better compatibility
	webpack: (config, { isServer }) => {
		// Use memory cache instead of file system cache to prevent ENOENT errors
		config.cache = { type: "memory" };

		if (isServer) {
			// Handle process exit gracefully
			config.externals = config.externals || [];
			// Exclude problematic packages
			config.externals.push("better-sqlite3");
		}

		return config;
	},
	// Override default signal handling
	onDemandEntries: {
		// Reduce memory usage and prevent exit issues
		maxInactiveAge: 25 * 1000,
		pagesBufferLength: 2,
	},
	// Disable problematic features
	compiler: {
		removeConsole: false,
	},
	// Auto-initialize Socket.IO server
	async rewrites() {
		// This ensures the socket endpoint is hit during build/startup
		return [];
	},
};

module.exports = nextConfig;
