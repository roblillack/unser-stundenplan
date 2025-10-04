import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "net.roblillack.stundenplan",
	appName: "Unser Stundenplan",
	webDir: "dist",
	server: {
		androidScheme: "https",
	},
};

export default config;
