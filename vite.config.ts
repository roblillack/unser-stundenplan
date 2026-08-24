import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { execSync } from "node:child_process";

// Identifies the code this bundle was built from. Vercel hands us the commit
// it is building; locally we ask git ourselves and fall back to the build time.
function buildVersion(): string {
	if (process.env.VERCEL_GIT_COMMIT_SHA) {
		return process.env.VERCEL_GIT_COMMIT_SHA;
	}

	try {
		return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
			.toString()
			.trim();
	} catch {
		return `build-${Date.now()}`;
	}
}

// Publishes the version of this build as /version.txt, so a long-running app
// (the iPad in the kitchen ...) can poll it and reload itself once a new
// version has been deployed.
function versionFile(version: string): Plugin {
	return {
		name: "version-file",
		generateBundle() {
			this.emitFile({ type: "asset", fileName: "version.txt", source: `${version}\n` });
		},
	};
}

const version = buildVersion();

// https://vite.dev/config/
export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
	},
	plugins: [
		react(),
		legacy({
			targets: ["safari >= 15"],
		}),
		versionFile(version),
	],
});
