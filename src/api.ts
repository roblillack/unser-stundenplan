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

export interface Group {
	id: number;
	local_id: string;
	name: string;
	meta: number;
	level_id: number;
}

export interface Student {
	id: number;
	forename: string;
	nickname: string;
	name: string;
	birthday: string | null;
	// All groups the student is part of: the class as well as every course
	groups: Group[];
	// The "main" group of the student, usually the class
	meta_groups: Group[];
}

export interface StudentsReply {
	data: Student[];
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
		level?: {
			id: number;
			name: string;
		};
	};
	subject: Subject;
	// "planned" marks a lesson deviating from the regular timetable, i.e. a
	// substitution from the "Vertretungsplan"
	status: "initial" | "canceled" | "hold" | "planned"; // WTF: Should be "cancelled" instead of "canceled"
	rooms: {
		id: number;
		local_id: string;
	}[];
	teachers: Teacher[];
	time: Time;
}

export interface SubjectList {
	// The name we call the kid by, e.g. "Max"
	studentName: string;
	// The class the kid is in, e.g. "5a" or "11/3"
	className: string;
	subjects: Lesson[];
}

export interface TimeTable {
	times: Record<number, Time>;
	classes: SubjectList[];
	notes: Notes[];
	daysOff?: number; // Number of days off before this timetable
	foundDate?: string; // The actual date where lessons were found (YYYY-MM-DD format)
}

export class ApiError extends Error {
	constructor(
		message: string,
		public statusCode: number,
	) {
		super(message);
		this.name = "ApiError";
	}
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
	}).then((response) => {
		if (!response.ok) {
			throw new ApiError(`HTTP error ${response.status}`, response.status);
		}
		return response.json();
	});
}

export function getStudents(apiToken: string): Promise<Student[]> {
	return get<StudentsReply>(apiToken, "students?include=groups").then((r) => r.data);
}

// The name of the class a student is in, e.g. "7/4". In the upper grades the
// "main" group carries a qualifier we do not care about, like
// "11DE3 - Tutorenkurs", which we strip down to "11DE3".
function className(student: Student, levelName?: string): string {
	for (const group of student.meta_groups) {
		const name = group.local_id.split(/\s+[-–—]\s+/)[0].trim();
		if (name) {
			return name;
		}
	}

	return levelName || "";
}

// The name we call the kid by: just the first of possibly several given names.
function studentName(student: Student): string {
	return (student.nickname || student.forename || student.name).trim().split(/\s+/)[0];
}

export function getTimeTables(apiToken: string, date: Date): Promise<TimeTable> {
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
	const processDay = (
		response: WeekJournalReply,
		students: Student[],
		checkDate: Date,
	): { timetable: TimeTable | null; hasLessons: boolean; checkedDate: string } => {
		const lessonsByStudent: Record<number, Lesson[]> = {};
		const timesByNumber: Record<number, Time> = {};
		let notes: Notes[] = [];
		const dateStr = formatDate(checkDate);
		let hasLessons = false;

		const groupsByStudent: Record<number, Set<number>> = {};
		for (const student of students) {
			groupsByStudent[student.id] = new Set(student.groups.map((x) => x.id));
		}

		// Level names as reported by the API, keyed by level id
		const levelNames: Record<number, string> = {};

		for (const day of response.data.days) {
			if (day.date !== dateStr) {
				continue;
			}
			if (day.notes) {
				notes = day.notes;
			}
			for (const lesson of day.lessons) {
				if (lesson.group.level?.name) {
					levelNames[lesson.group.level_id] = lesson.group.level.name;
				}

				for (const student of students) {
					// The journal contains the lessons of the whole year level, so it
					// also lists all the parallel courses the student is *not* part of.
					// Only keep the ones taking place in one of the student's groups.
					if (!groupsByStudent[student.id].has(lesson.group.id)) {
						continue;
					}

					hasLessons = true;
					lessonsByStudent[student.id] = lessonsByStudent[student.id] || [];
					lessonsByStudent[student.id].push(lesson);

					if (!timesByNumber[lesson.nr]) {
						timesByNumber[lesson.nr] = lesson.time;
					}
				}
			}
		}

		if (!hasLessons) {
			return { timetable: null, hasLessons: false, checkedDate: dateStr };
		}

		const classes: SubjectList[] = students
			.filter((student) => lessonsByStudent[student.id]?.length > 0)
			// Youngest kid gets the first column
			.sort((a, b) => (b.birthday || "").localeCompare(a.birthday || ""))
			.map((student) => {
				const lessons = lessonsByStudent[student.id];
				lessons.sort((a, b) => a.nr - b.nr);
				return {
					studentName: studentName(student),
					className: className(student, levelNames[lessons[0].group.level_id]),
					subjects: lessons,
				};
			});

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
		// Which lessons are relevant depends on the groups our kids are in
		const students = await getStudents(apiToken);

		const searchDate = new Date(startDate);
		let daysChecked = 0;

		while (daysChecked < maxDays) {
			// Skip weekends
			if (searchDate.getDay() !== 0 && searchDate.getDay() !== 6) {
				const weekData = await fetchWeekData(searchDate);
				const result = processDay(weekData, students, searchDate);

				if (result.hasLessons && result.timetable) {
					// Calculate days off (including weekends)
					const daysOff = Math.floor(
						(searchDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
					);
					return {
						...result.timetable,
						daysOff: daysOff > 0 ? daysOff : undefined,
						foundDate: formatDate(searchDate),
					};
				}
			}

			// Move to next day
			searchDate.setDate(searchDate.getDate() + 1);
			daysChecked++;
		}

		// If no school day found in 3 weeks, return the original date anyway
		const weekData = await fetchWeekData(startDate);
		const result = processDay(weekData, students, startDate);
		return (
			result.timetable || {
				times: {},
				notes: [],
				classes: [],
			}
		);
	})();
}
