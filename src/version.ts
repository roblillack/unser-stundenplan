// The version of the code we are currently running, baked in at build time
export const APP_VERSION = __APP_VERSION__;

// Remembers the version we last reloaded for, so a browser stubbornly holding
// on to a cached index.html cannot put us into an endless reload loop
const RELOADED_FOR_KEY = "reloadedForVersion";

// The version currently deployed, or null if we cannot tell. Not available
// during development, where nothing is being built.
export async function getDeployedVersion(): Promise<string | null> {
	try {
		// Cache busting both for the browser and for the CDN in front of us
		const response = await fetch(`/version.txt?t=${Date.now()}`, { cache: "no-store" });
		if (!response.ok) {
			return null;
		}

		const version = (await response.text()).trim();
		return version || null;
	} catch {
		return null;
	}
}

// Reload the page if a newer version of the app has been deployed in the
// meantime, so we do not have to wait for the periodic reload to pick it up.
export async function reloadIfOutdated(): Promise<void> {
	const deployed = await getDeployedVersion();
	if (!deployed || deployed === APP_VERSION) {
		return;
	}

	try {
		if (window.sessionStorage.getItem(RELOADED_FOR_KEY) === deployed) {
			// We already tried and still ended up with the old code -- give up
			// and leave it to the periodic reload.
			return;
		}
		window.sessionStorage.setItem(RELOADED_FOR_KEY, deployed);
	} catch {
		// No session storage: reload anyway, we just lose the loop protection
	}

	console.log(`Reloading: version ${APP_VERSION} -> ${deployed}`);
	location.reload();
}
