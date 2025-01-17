import { useEffect } from "react";

export function useVisibilityChange(
	callback: (isVisible: boolean) => void,
	deps: unknown[],
) {
	useEffect(() => {
		const handler = () => {
			callback(document.visibilityState === "visible");
		};

		document.addEventListener("visibilitychange", handler);
		return () => {
			document.removeEventListener("visibilitychange", handler);
		};
	}, [callback, ...deps]);
}

export function useWakeLock() {
	useEffect(() => {
		let wakeLock: WakeLockSentinel | null = null;

		async function requestWakeLock() {
			try {
				wakeLock = await navigator.wakeLock.request("screen");
			} catch (e) {
				console.error(e);
			}
		}

		requestWakeLock();

		return () => {
			if (wakeLock) {
				wakeLock.release();
			}
		};
	}, []);
}
