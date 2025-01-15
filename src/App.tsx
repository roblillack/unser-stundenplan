import { useEffect, useState } from "react";
import "./App.css";
import { getTimeTables, type Lesson, type SubjectList } from "./api";

const REFRESH_INTERVAL_MS = 1000 * 60 * 15;
// const REFRESH_INTERVAL_MS = 1000 * 30;

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

function useVisibilityChange(
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

function useWakeLock() {
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

function App() {
	const [apiToken, setApiToken] = useState("");
	const [state, setState] = useState<"nodata" | "loading" | "loaded" | "error">(
		"nodata",
	);
	const [timetable, setTimetable] = useState<MergedTimeTable | undefined>();

	useEffect(() => {
		if (!apiToken) {
			const storedToken = window.localStorage.getItem("apiToken");
			if (storedToken) {
				setApiToken(storedToken);
				return;
			}
			const t = window.prompt(
				"Bitte hier den API-Token für “Beste Schule” eintragen",
			);
			if (t) {
				window.localStorage.setItem("apiToken", t);
				setApiToken(t);
			}
		}
	}, [apiToken]);

	useVisibilityChange(
		(isVisible) => {
			if (
				isVisible &&
				(!timetable ||
					timetable.updated.getTime() < Date.now() - REFRESH_INTERVAL_MS)
			) {
				setState("nodata");
			}
		},
		[timetable],
	);
	useEffect(() => {
		if (!apiToken) {
			return;
		}

		async function fetchData() {
			setState("loading");
			const d = getValidDate();
			setTimetable(mergeSubjectLists(d, await getTimeTables(apiToken, d)));

			setTimeout(() => {
				setState("nodata");
			}, REFRESH_INTERVAL_MS);
			setState("loaded");
		}

		if (!timetable || state !== "loaded") {
			fetchData();
		}
	}, [apiToken, timetable, state]);
	useWakeLock();

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
			{timetable && (
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
			)}
			<p className="footer">
				{timetable &&
					`Zuletzt aktualisiert: ${timetable.updated.toLocaleString([], {
						day: "2-digit",
						month: "2-digit",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					})}`}
				{state === "loading" && <>{" lade... "}</>}
			</p>
		</>
	);
}

export default App;
