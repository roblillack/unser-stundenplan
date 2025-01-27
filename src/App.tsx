import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { getTimeTables, type Lesson, type SubjectList } from "./api";
import { type DateString, formatDate, nextValidDate } from "./dates";

// Update the timetable every 7 minutes
const REFRESH_INTERVAL_MS = 1000 * 60 * 7;
// const REFRESH_INTERVAL_MS = 1000 * 10;

// Every 6 hours, reload the page to get the latest version of the app
const RELOAD_INTERVAL_MS = 1000 * 60 * 60 * 6;
// const RELOAD_INTERVAL_MS = 1000 * 30;

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
	dateStr: DateString,
	timetables: SubjectList[],
): MergedTimeTable {
	// const dateStr = date.toISOString().substring(0, 10);
	const r: MergedTimeTable = {
		date: dateStr,
		isToday: dateStr === formatDate(new Date()),
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
	if (subject.subject.name.length >= 15) {
		return subject.subject.local_id;
	}
	return subject.subject.name;
}

type State = "initial" | "loading" | "loaded" | "error";

function StateDisplay({
	state,
	onClick,
}: {
	state: State;
	onClick: () => void;
}) {
	if (state === "initial" || state === "loading") {
		return "Lade …";
	}

	return (
		<>
			{state === "error" ? "Fehler! " : ""}
			<button
				className="linkbutton"
				type="button"
				onClick={onClick}
				disabled={!(state === "loaded" || state === "error")}
			>
				Aktualisieren
			</button>
		</>
	);
}

function App() {
	const [apiToken, setApiToken] = useState("");
	const [state, setState] = useState<State>("initial");
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

	const updateTimetable = useCallback(async () => {
		if (!apiToken) {
			return;
		}

		setState("loading");

		const d = nextValidDate();
		getTimeTables(apiToken, d)
			.then((timetables) => {
				setTimetable(mergeSubjectLists(formatDate(d), timetables));
				setState("loaded");
			})
			.catch(() => {
				setState("error");
			});
	}, [apiToken]);

	useEffect(() => {
		const h = setInterval(updateTimetable, REFRESH_INTERVAL_MS);
		updateTimetable();
		return () => clearInterval(h);
	}, [updateTimetable]);

	useEffect(() => {
		const h = setInterval(() => location.reload(), RELOAD_INTERVAL_MS);
		return () => clearInterval(h);
	}, []);

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
					})} — `}
				<StateDisplay state={state} onClick={updateTimetable} />
			</p>
		</>
	);
}

export default App;
