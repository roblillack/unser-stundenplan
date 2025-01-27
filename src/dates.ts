// A date string in the format "YYYY-MM-DD"
export type DateString = string;

export function formatDate(date: Date): DateString {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
		date.getDate(),
	).padStart(2, "0")}`;
}

export function nextValidDate(): Date {
	const d = new Date();
	if (d.getHours() >= 17) {
		d.setDate(d.getDate() + 1);
	}

	while (d.getDay() === 0 || d.getDay() === 6) {
		d.setDate(d.getDate() + 1);
	}

	return d;
}

export function calcIsoWeek(date: Date): number {
	const dt = new Date(date.valueOf());
	dt.setHours(0, 0, 0, 0);
	// Thursday in current week decides the year.
	dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
	// January 4 is always in week 1.
	const week1 = new Date(dt.getFullYear(), 0, 4);
	// Adjust to Thursday in week 1 and count number of weeks from date to week1.
	return (
		1 +
		Math.round(
			((date.getTime() - week1.getTime()) / 86400000 -
				3 +
				((week1.getDay() + 6) % 7)) /
				7,
		)
	);
}

export function calcIsoYear(date: Date): number {
	const dt = new Date(date.getTime());
	dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
	return dt.getFullYear();
}
