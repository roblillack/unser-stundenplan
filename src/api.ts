const API_TOKEN =
	"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxMiIsImp0aSI6ImExNGYyNmM5M2Q4NDA4NTVhMjQ1ZmY5MjRjYzQ3MDZjNTZhNTRmYWJmZjIzYTljYTY0MTAxMjJkZWI4MWZhN2U3NGNiMDJlMDM5MDBhZDQ2IiwiaWF0IjoxNzM2NzYxODAyLjE3OTQxMSwibmJmIjoxNzM2NzYxODAyLjE3OTQxMywiZXhwIjoxNzY4Mjk3ODAyLjE3NzU2MSwic3ViIjoiMTg4MTgzIiwic2NvcGVzIjpbXX0.tNEhE0txTwGNFt3UVZl3BUaro9XoQnpEPXBovTghyHG0hy-3KjQHZb3Jzr72jvFkm9XwwGDEps7HU7i35MZ65oKg4YB-ExcIqdYRkmz6W3yQLcbvhptKfKcGFDiDDtieumE76bEHquswZ4dbrFR2CPRw0U5aFo7J6-c0YMOS7OUUD9rPZCLSbg-cDWkMNwMCHv7YpeqDdXDaNx4azrz2vADWlOv8MDA4Ld1TlymWbWvXIQVjxcMPU2NNtk-Al8GAznAWVboHJoGeGuoBStBRBdIGfeHDNL5HNYmO6J12WTBUk4gajlZK8ZvZioafcf1fR2OVkPzV30e1xZEncZbHtVGR2n64hw8xH7LCJPsz1HR7bxXelCI7sATV1fGt6XH5-ZDpAYGyXLG661tLILpi_jVacsSRXsDdBzH1vptMIpts4YTGKJ4_6BDOMWrhpmOvOyQY_eFjNATI8iCXre8xMylbbwnAfUCr8xSYEeNctmH5tWop5kXTs9lmJl0WwKYlYKiZw-F2Naloq3pufHlFFt39nJoOHl2pQGtRimwRrcTPtR4bpSREnK3R0xAeBSJHTlKrD3CN6CTUz7v93wUgfLBwc7Zsqf4tOIgb6g1fWp8Rjw2nuJ0gBBfSebmVGPp4-dHA4iBAioo7T7p3NMxhGlyin-vpOpBZQUsDbRF4Nsw";

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
