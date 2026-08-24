import { useCallback, useEffect, useState } from "react";

import { ApiError, getTimeTables, type Lesson, type Time, type TimeTable } from "./api";
import { REFRESH_INTERVAL_MS, RELOAD_INTERVAL_MS, SHOW_COUNTDOWN_DAYS } from "./contants";
import { type DateString, formatDate, nextValidDate } from "./dates";

import "./App.css";

interface MergedTimeTable {
	// Formatted date, the timetable is for. Format: "YYYY-MM-DD"
	date: string;
	// True if the timetable is for today
	isToday: boolean;
	// One column per kid
	columns: { studentName: string; className: string }[];
	hours: {
		hour: number;
		time?: Time;
		subjects: (Lesson | null)[];
	}[];
	notes: string[];
	lastHour: number;
	// Timestamp of the last update
	updated: Date;
	// Number of days off before this timetable
	daysOff?: number;
}

function mergeSubjectLists(dateStr: DateString, timetable: TimeTable): MergedTimeTable {
	// const dateStr = date.toISOString().substring(0, 10);
	const r: MergedTimeTable = {
		date: dateStr,
		isToday: dateStr === formatDate(new Date()),
		columns: [],
		hours: [],
		lastHour: -1,
		updated: new Date(),
		notes: [],
		daysOff: timetable.daysOff,
	};

	r.lastHour = timetable.classes.reduce(
		(acc, tt) => tt.subjects.reduce((acc, x) => (x.nr > acc ? x.nr : acc), acc),
		-1,
	);
	r.columns = timetable.classes.map(({ studentName, className }) => ({ studentName, className }));

	for (let i = 1; i <= r.lastHour; i++) {
		const hour: { hour: number; time?: Time; subjects: (Lesson | null)[] } = {
			hour: i,
			time: timetable.times[i],
			subjects: [],
		};
		// One column per kid -- indexed by position, as two of them might well
		// end up being in the same class.
		for (const tt of timetable.classes) {
			hour.subjects.push(tt.subjects.find((x) => x.nr === i) || null);
		}
		r.hours.push(hour);
	}

	for (const notes of timetable.notes) {
		if (!notes.description) continue;
		for (let x of notes.description.split("\n")) {
			x = x.replace(/^[-–—]+/, "").trim();
			if (x.length > 0) {
				r.notes.push(x);
			}
		}
	}

	return r;
}

// Lessons the API flags as "planned" are not part of the regular timetable:
// they come from the "Vertretungsplan".
function subjectClassName(subject: Lesson | null): string {
	if (subject?.status === "canceled") {
		return "subject cancelled";
	}
	if (subject?.status === "planned") {
		return "subject substitution";
	}
	return "subject";
}

function subjectName(subject: Lesson): string {
	if (!subject.subject.name || subject.subject.name.length >= 15) {
		return subject.subject.local_id;
	}

	return subject.subject.name;
}

type State = "initial" | "loading" | "loaded" | "error";

function StateDisplay({
	state,
	errorCode,
	onClick,
	onLogout,
}: {
	state: State;
	errorCode?: number;
	onClick: () => void;
	onLogout: () => void;
}) {
	if (state === "initial" || state === "loading") {
		return "Lade …";
	}

	if (state === "error") {
		return (
			<>
				{`Fehler${errorCode ? `: ${errorCode}` : ""}!`}
				<br />
				<button className="linkbutton" onClick={onClick} type="button">
					Aktualisieren
				</button>
				{", "}
				<button className="linkbutton" onClick={onLogout} type="button">
					Logout
				</button>
			</>
		);
	}

	return (
		<button
			className="linkbutton"
			disabled={state !== "loaded"}
			onClick={onClick}
			type="button"
		>
			Aktualisieren
		</button>
	);
}

function TokenInput({ onSubmit }: { onSubmit: (token: string) => void }) {
	const [token, setToken] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (token.trim()) {
			onSubmit(token.trim());
		}
	};

	return (
		<div className="token-input-overlay">
			<div className="token-input-modal">
				<h2>API-Token eingeben</h2>
				<p>Bitte hier den API-Token für "Beste Schule" eintragen:</p>
				<form onSubmit={handleSubmit}>
					<input
						autoFocus
						onChange={(e) => setToken(e.target.value)}
						placeholder="API-Token"
						required
						type="text"
						value={token}
					/>
					<button type="submit">Bestätigen</button>
				</form>
			</div>
		</div>
	);
}

function App() {
	const [apiToken, setApiToken] = useState("");
	const [showTokenInput, setShowTokenInput] = useState(false);
	const [state, setState] = useState<State>("initial");
	const [errorCode, setErrorCode] = useState<number | undefined>();
	const [timetable, setTimetable] = useState<MergedTimeTable | undefined>();

	useEffect(() => {
		if (!apiToken) {
			const storedToken = window.localStorage.getItem("apiToken");
			if (storedToken) {
				setApiToken(storedToken);
				return;
			}
			setShowTokenInput(true);
		}
	}, [apiToken]);

	const handleTokenSubmit = (token: string) => {
		window.localStorage.setItem("apiToken", token);
		setApiToken(token);
		setShowTokenInput(false);
	};

	const handleLogout = () => {
		window.localStorage.removeItem("apiToken");
		setApiToken("");
		setState("initial");
		setErrorCode(undefined);
		setTimetable(undefined);
		setShowTokenInput(true);
	};

	const updateTimetable = useCallback(async () => {
		if (!apiToken) {
			return;
		}

		setState("loading");
		setErrorCode(undefined);

		const d = nextValidDate();
		getTimeTables(apiToken, d)
			.then((timetables) => {
				// Use foundDate if available, otherwise fall back to the original date
				const displayDate = timetables.foundDate || formatDate(d);
				setTimetable(mergeSubjectLists(displayDate, timetables));
				setState("loaded");
			})
			.catch((error) => {
				console.error("Failed to update timetable:", error);
				setState("error");
				if (error instanceof ApiError) {
					setErrorCode(error.statusCode);
				}
			});
	}, [apiToken]);

	useEffect(() => {
		// Only set up periodic updates if there are no days off
		// (if there are days off, we just wait for the page reload)
		const shouldUpdate = !timetable || !timetable.daysOff || timetable.daysOff === 0;

		if (shouldUpdate) {
			const h = setInterval(updateTimetable, REFRESH_INTERVAL_MS);
			return () => clearInterval(h);
		}
	}, [updateTimetable, timetable]);

	useEffect(() => {
		// Initial load
		updateTimetable();
	}, [updateTimetable]);

	useEffect(() => {
		const h = setInterval(() => location.reload(), RELOAD_INTERVAL_MS);
		return () => clearInterval(h);
	}, []);

	const noSchoolFound = timetable && timetable.columns.length === 0;
	const isHolidayMode =
		noSchoolFound ||
		(timetable?.daysOff !== undefined && timetable?.daysOff >= SHOW_COUNTDOWN_DAYS);

	// Toggle holiday background class on the root element
	useEffect(() => {
		const root = document.getElementById("root");
		if (!root) return;

		document
			.getElementsByTagName("meta")
			.namedItem("theme-color")
			?.setAttribute("content", isHolidayMode ? "#000000" : "#ffffff");

		if (isHolidayMode) {
			root.classList.add("holiday-mode");
		} else {
			root.classList.remove("holiday-mode");
		}
	}, [isHolidayMode]);

	return (
		<>
			{showTokenInput && <TokenInput onSubmit={handleTokenSubmit} />}
			<div className="main">
				{isHolidayMode ? (
					<>
						<h1 className="holidays">FERIEN!</h1>
						{timetable && timetable.daysOff !== undefined && timetable.daysOff >= 1 && (
							<h2 className="holidays">
								Bis zum nächsten Schultag noch <span>{timetable.daysOff} Tage</span> frei.
							</h2>
						)}
					</>
				) : (
					<>
						<h1>{timetable?.isToday === false ? "Nächster Stundenplan" : "Stundenplan"}</h1>
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
										{timetable?.columns.map((col, idx) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
											<th key={`${idx}-${col.studentName}`}>
												{[col.studentName, col.className].filter(Boolean).join(" • ")}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{timetable?.hours.map((hour) => (
										<tr key={hour.hour}>
											<td className="hour" key="hour">
												<b>{hour.hour}</b>
												{hour.time && (
													<>
														<br />
														<small>
															{hour.time.from}–{hour.time.to}
														</small>
													</>
												)}
											</td>
											{hour.subjects.map((subject, idx) => (
												<td
													className={subjectClassName(subject)}
													key={`${idx}-${hour.hour}`}
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
															{subject.teachers.map((x) => `${x.forename} ${x.name}`).join("/")}{" "}
															<br />
															{subject.rooms.length > 0 && (
																<small>Raum {subject.rooms.map((x) => x.local_id).join("/")}</small>
															)}
														</>
													)}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						)}
						{timetable && timetable.notes.length > 0 && (
							<p className="notes">{timetable.notes.map((x) => x.trim()).join(" • ")}</p>
						)}
					</>
				)}
			</div>
			<p className="footer">
				{timetable &&
					`Zuletzt aktualisiert: ${timetable.updated.toLocaleString([], {
						day: "2-digit",
						month: "2-digit",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					})} — `}
				<StateDisplay errorCode={errorCode} onClick={updateTimetable} onLogout={handleLogout} state={state} />
			</p>
		</>
	);
}

export default App;
