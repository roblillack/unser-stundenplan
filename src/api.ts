const API_TOKEN = "xxx";

export interface WeekJournalReply {
	data: {
		days: Day[];
	};
}

export interface Day {
	id: string;
	date: string;
	lessons: Lesson[];
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
}

export interface SubjectList {
	className: string;
	subjects: Lesson[];
}

export function get<T>(path: string): Promise<T> {
	const url = new URL(`https://beste.schule/api/${path}`);

	const headers = {
		Authorization: `Bearer ${API_TOKEN}`,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	return fetch(url, {
		method: "GET",
		headers,
	}).then((response) => response.json());
}

function calcIsoWeek(date: Date): number {
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

function calcIsoYear(date: Date): number {
	const dt = new Date(date.getTime());
	dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
	return dt.getFullYear();
}

export function getTimeTables(date: Date): Promise<SubjectList[]> {
	const isoWeek = `${calcIsoYear(date)}-${calcIsoWeek(date)}`;

	return get<WeekJournalReply>(
		`journal/weeks/${isoWeek}?include=days.lessons&interpolate=true`,
	).then((response) => {
		const lessonsByLevel: Record<number, Lesson[]> = {};
		const namesByLevel: Record<number, string> = {};
		for (const day of response.data.days) {
			if (day.date !== date.toISOString().slice(0, 10)) {
				continue;
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
			}
		}

		const r: SubjectList[] = [];
		for (const level in lessonsByLevel) {
			lessonsByLevel[level].sort((a, b) => a.nr - b.nr);
			r.push({
				className: namesByLevel[level],
				subjects: lessonsByLevel[level],
			});
		}

		return r;
	});
}
