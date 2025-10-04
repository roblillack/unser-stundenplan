
// Update the timetable every 7 minutes
export const REFRESH_INTERVAL_MS = 1000 * 60 * 7;
// export const REFRESH_INTERVAL_MS = 1000 * 10;

// Every 6 hours, reload the page to get the latest version of the app
export const RELOAD_INTERVAL_MS = 1000 * 60 * 60 * 6;
// export const RELOAD_INTERVAL_MS = 1000 * 30;

// Maximum number of days off to check for (up to 50 days off, so we don't
// check forever, but still cover ~7 weeks of holidays)
export const MAX_DAYS_OFF = 50;

// Show a countdown instead of a timetable if there are at least this many
// days off
export const SHOW_COUNTDOWN_DAYS = 5;