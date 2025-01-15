import { useEffect, useState } from "react";
import "./App.css";
import { getTimeTables, type Lesson, type SubjectList } from "./api";

interface MergedTimeTable {
	// Formatted date, the timetable is for. Format: "YYYY-MM-DD"
	date: string;
	// True if the timetable is for today
	isToday: boolean;
	// List of class names
	classNames: string[];
	hours: {
		hour: number;
		subjects: (Lesson | null)[];
	}[];
	lastHour: number;
	// Timestamp of the last update
	updated: Date;
}

function mergeSubjectLists(
	date: Date,
	timetables: SubjectList[],
): MergedTimeTable {
	const dateStr = date.toISOString().substring(0, 10);
	const r: MergedTimeTable = {
		date: dateStr,
		isToday: dateStr === new Date().toISOString().substring(0, 10),
		classNames: [],
		hours: [],
		lastHour: -1,
		updated: new Date(),
	};

	r.lastHour = timetables.reduce(
		(acc, tt) => tt.subjects.reduce((acc, x) => (x.nr > acc ? x.nr : acc), acc),
		-1,
	);
	r.classNames = timetables.map((x) => x.className);

	for (let i = 1; i <= r.lastHour; i++) {
		const hour: { hour: number; subjects: (Lesson | null)[] } = {
			hour: i,
			subjects: [],
		};
		for (const className of r.classNames) {
			const tt = timetables.find((x) => x.className === className);
			if (!tt) {
				continue;
			}
			hour.subjects.push(tt.subjects.find((x) => x.nr === i) || null);
		}
		r.hours.push(hour);
	}

	return r;
}

function subjectName(subject: Lesson): string {
	if (subject.subject.name.length > 10) {
		return subject.subject.local_id;
	}
	return subject.subject.name;
}

function getValidDate(): Date {
	const d = new Date();
	if (d.getHours() >= 17) {
		d.setDate(d.getDate() + 1);
	}

	while (d.getDay() === 0 || d.getDay() === 6) {
		d.setDate(d.getDate() + 1);
	}

	return d;
}

function App() {
	const [timetable, setTimetable] = useState<MergedTimeTable | undefined>();

	useEffect(() => {
		async function fetchData() {
			const d = getValidDate();
			setTimetable(mergeSubjectLists(d, await getTimeTables(d)));

			setTimeout(
				() => {
					setTimetable(undefined);
				},
				1000 * 60 * 15,
			);
		}

		if (!timetable) {
			fetchData();
		}
	}, [timetable]);

	return (
		<>
			<h1>
				{timetable?.isToday === false ? "Nächster Stundenplan" : "Stundenplan"}
			</h1>
			<h2>
				{timetable &&
					new Date(timetable.date).toLocaleDateString(undefined, {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
					})}
			</h2>
			<table className="timetable">
				<thead>
					<tr>
						<th>Stunde</th>
						{timetable?.classNames.map((x) => (
							<th key={x}>{x}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{timetable?.hours.map((hour) => (
						<tr key={hour.hour}>
							<td className="hour" key="hour">
								{hour.hour}
							</td>
							{hour.subjects.map((subject, idx) => (
								<td
									className={`subject ${subject?.status === "canceled" ? "cancelled" : ""}`}
									key={`${timetable?.classNames[idx]}-${hour.hour}`}
								>
									{subject && (
										<>
											<b>
												{subject.status === "canceled" ? (
													<s>{subjectName(subject)}</s>
												) : (
													subjectName(subject)
												)}
											</b>
											<br />
											{subject.teachers
												.map((x) => `${x.forename} ${x.name}`)
												.join("/")}{" "}
											<br />
											<small>
												Raum {subject.rooms.map((x) => x.local_id).join("/")}
											</small>
										</>
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<p className="footer">
				Zuletzt aktualisiert: {timetable?.updated.toLocaleString()}
			</p>
		</>
	);
}

export default App;
