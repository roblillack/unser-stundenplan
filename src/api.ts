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
): Promise<SubjectList[]> {
	const isoWeek = `${calcIsoYear(date)}-${calcIsoWeek(date)}`;

	return get<WeekJournalReply>(
		apiToken,
		`journal/weeks/${isoWeek}?include=days.lessons&interpolate=true`,
	).then((response) => {
		const lessonsByLevel: Record<number, Lesson[]> = {};
		const namesByLevel: Record<number, string> = {};
		for (const day of response.data.days) {
			if (day.date !== formatDate(date)) {
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
