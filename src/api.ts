import { MAX_DAYS_OFF } from "./contants";
import { calcIsoWeek, calcIsoYear, formatDate } from "./dates";

export interface WeekJournalReply {
	data: {
		days: Day[];
	};
}

export interface Day {
	id: string;
	date: string;
	lessons: Lesson[];
	notes: Notes[];
}

export interface Notes {
	id: null;
	for: "guardian";
	source: "substitutionplan";
	description: string;
	notable_type: null;
}

export interface Teacher {
	id: number;
	local_id: string;
	forename: string;
	name: string;
}

export interface Subject {
	for: "student";
	id: number;
	local_id: string;
	name: string;
	tags: string[];
}

export interface Time {
	id: number;
	nr: number;
	from: string;
	to: string;
}

export interface Lesson {
	id: number;
	nr: number;
	group: {
		id: number;
		local_id: string;
		level_id: number;
	};
	subject: Subject;
	status: "initial" | "canceled" | "hold" | "planned"; // WTF: Should be "cancelled" instead of "canceled"
	rooms: {
		id: number;
		local_id: string;
	}[];
	teachers: Teacher[];
	time: Time;
}

export interface SubjectList {
	className: string;
	subjects: Lesson[];
}

export interface TimeTable {
	times: Record<number, Time>;
	classes: SubjectList[];
	notes: Notes[];
	daysOff?: number; // Number of days off before this timetable
}

export function get<T>(apiToken: string, path: string): Promise<T> {
	const url = new URL(`https://beste.schule/api/${path}`);

	const headers = {
		Authorization: `Bearer ${apiToken}`,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	return fetch(url, {
		method: "GET",
		headers,
	}).then((response) => response.json());
}

export function getTimeTables(
	apiToken: string,
	date: Date,
): Promise<TimeTable> {
	const startDate = new Date(date);
	const maxDays = MAX_DAYS_OFF;

	// Cache to store week data by isoWeek identifier
	const weekCache: Record<string, WeekJournalReply> = {};

	// Helper function to fetch a week (with caching)
	const fetchWeekData = async (checkDate: Date): Promise<WeekJournalReply> => {
		const isoWeek = `${calcIsoYear(checkDate)}-${calcIsoWeek(checkDate)}`;

		if (!weekCache[isoWeek]) {
			weekCache[isoWeek] = await get<WeekJournalReply>(
				apiToken,
				`journal/weeks/${isoWeek}?include=days.lessons&interpolate=true`,
			);
		}

		return weekCache[isoWeek];
	};

	// Helper function to process a single day from week data
	const processDay = (response: WeekJournalReply, checkDate: Date): { timetable: TimeTable | null; hasLessons: boolean; checkedDate: string } => {
		const lessonsByLevel: Record<number, Lesson[]> = {};
		const namesByLevel: Record<number, string> = {};
		const timesByNumber: Record<number, Time> = {};
		let notes: Notes[] = [];
		const dateStr = formatDate(checkDate);
		let hasLessons = false;

		for (const day of response.data.days) {
			if (day.date !== dateStr) {
				continue;
			}
			if (day.notes) {
				notes = day.notes;
			}
			if (day.lessons && day.lessons.length > 0) {
				hasLessons = true;
			}
			for (const lesson of day.lessons) {
				lessonsByLevel[lesson.group.level_id] =
					lessonsByLevel[lesson.group.level_id] || [];
				lessonsByLevel[lesson.group.level_id].push(lesson);

				if (namesByLevel[lesson.group.level_id] === undefined) {
					namesByLevel[lesson.group.level_id] = lesson.group.local_id;
				} else {
					// find common prefix to determine class name
					let common = "";
					for (let i = 0; i < lesson.group.local_id.length; i++) {
						if (
							lesson.group.local_id[i] ===
							namesByLevel[lesson.group.level_id][i]
						) {
							common += lesson.group.local_id[i];
						} else {
							break;
						}
					}
					namesByLevel[lesson.group.level_id] = common;
				}
				if (!timesByNumber[lesson.nr]) {
					timesByNumber[lesson.nr] = lesson.time;
				}
			}
		}

		if (!hasLessons) {
			return { timetable: null, hasLessons: false, checkedDate: dateStr };
		}

		const classes: SubjectList[] = [];
		for (const level in lessonsByLevel) {
			lessonsByLevel[level].sort((a, b) => a.nr - b.nr);
			classes.push({
				className: namesByLevel[level],
				subjects: lessonsByLevel[level],
			});
		}

		return {
			timetable: {
				times: timesByNumber,
				notes,
				classes,
			},
			hasLessons: true,
			checkedDate: dateStr,
		};
	};

	// Search for the next school day with lessons
	return (async () => {
		const searchDate = new Date(startDate);
		let daysChecked = 0;

		while (daysChecked < maxDays) {
			// Skip weekends
			if (searchDate.getDay() !== 0 && searchDate.getDay() !== 6) {
				const weekData = await fetchWeekData(searchDate);
				const result = processDay(weekData, searchDate);

				if (result.hasLessons && result.timetable) {
					// Calculate days off (including weekends)
					const daysOff = Math.floor((searchDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
					return {
						...result.timetable,
						daysOff: daysOff > 0 ? daysOff : undefined,
					};
				}
			}

			// Move to next day
			searchDate.setDate(searchDate.getDate() + 1);
			daysChecked++;
		}

		// If no school day found in 3 weeks, return the original date anyway
		const weekData = await fetchWeekData(startDate);
		const result = processDay(weekData, startDate);
		return result.timetable || {
			times: {},
			notes: [],
			classes: [],
		};
	})();
}
