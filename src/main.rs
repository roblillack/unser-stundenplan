#![allow(non_snake_case)]

mod api;
mod dates;

use api::{get_timetables, Lesson, Time, TimeTable};
use chrono::Local;
use dates::{format_date, next_valid_date};
use dioxus::prelude::*;
use dioxus_logger::tracing::{info, Level};
use gloo_storage::{LocalStorage, Storage};
use gloo_timers::future::TimeoutFuture;
use wasm_bindgen::JsCast;

// Update the timetable every 7 minutes
const REFRESH_INTERVAL_MS: u32 = 1000 * 60 * 7;

// Every 6 hours, reload the page to get the latest version of the app
const RELOAD_INTERVAL_MS: u32 = 1000 * 60 * 60 * 6;

#[derive(Clone, Debug, PartialEq)]
struct MergedTimeTable {
    date: String,
    is_today: bool,
    class_names: Vec<String>,
    hours: Vec<Hour>,
    notes: Vec<String>,
    last_hour: i32,
    updated: String,
}

#[derive(Clone, Debug, PartialEq)]
struct Hour {
    hour: i32,
    time: Option<Time>,
    subjects: Vec<Option<Lesson>>,
}

fn merge_subject_lists(date_str: String, timetable: TimeTable) -> MergedTimeTable {
    let is_today = date_str == format_date(&Local::now().date_naive());
    let mut r = MergedTimeTable {
        date: date_str,
        is_today,
        class_names: Vec::new(),
        hours: Vec::new(),
        notes: Vec::new(),
        last_hour: -1,
        updated: Local::now().format("%d.%m.%Y, %H:%M").to_string(),
    };

    // Find the last hour
    for class in &timetable.classes {
        for subject in &class.subjects {
            if subject.nr > r.last_hour {
                r.last_hour = subject.nr;
            }
        }
    }

    r.class_names = timetable.classes.iter().map(|c| c.class_name.clone()).collect();

    // Build hours
    for i in 1..=r.last_hour {
        let mut hour = Hour {
            hour: i,
            time: timetable.times.get(&i).cloned(),
            subjects: Vec::new(),
        };

        for class_name in &r.class_names {
            let class = timetable.classes.iter().find(|c| &c.class_name == class_name);
            let subject = class.and_then(|c| c.subjects.iter().find(|s| s.nr == i));
            hour.subjects.push(subject.cloned());
        }

        r.hours.push(hour);
    }

    // Parse notes
    for note in timetable.notes {
        for line in note.description.split('\n') {
            let trimmed = line.trim_start_matches(|c| c == '-' || c == '–' || c == '—').trim();
            if !trimmed.is_empty() {
                r.notes.push(trimmed.to_string());
            }
        }
    }

    r
}

fn subject_name(subject: &Lesson) -> String {
    if subject.subject.name.is_empty() || subject.subject.name.len() >= 15 {
        subject.subject.local_id.clone()
    } else {
        subject.subject.name.clone()
    }
}

#[derive(Clone, Copy, PartialEq)]
enum State {
    Initial,
    Loading,
    Loaded,
    Error,
}

#[component]
fn StateDisplay(state: State, on_click: EventHandler<()>) -> Element {
    match state {
        State::Initial | State::Loading => rsx! { "Lade …" },
        State::Loaded | State::Error => rsx! {
            {(state == State::Error).then(|| rsx! { "Fehler! " })}
            button {
                class: "linkbutton",
                r#type: "button",
                onclick: move |_| on_click.call(()),
                disabled: !(state == State::Loaded || state == State::Error),
                "Aktualisieren"
            }
        },
    }
}

#[component]
fn TokenInput(on_submit: EventHandler<String>) -> Element {
    let mut token = use_signal(|| String::new());

    let handle_submit = move |evt: FormEvent| {
        evt.prevent_default();
        let t = token().trim().to_string();
        if !t.is_empty() {
            on_submit.call(t);
        }
    };

    rsx! {
        div { class: "token-input-overlay",
            div { class: "token-input-modal",
                h2 { "API-Token eingeben" }
                p { "Bitte hier den API-Token für \"Beste Schule\" eintragen:" }
                form { onsubmit: handle_submit,
                    input {
                        r#type: "text",
                        value: "{token}",
                        oninput: move |evt| token.set(evt.value().clone()),
                        placeholder: "API-Token",
                        autofocus: true,
                        required: true
                    }
                    button { r#type: "submit", "Bestätigen" }
                }
            }
        }
    }
}

fn App() -> Element {
    let mut api_token = use_signal(|| String::new());
    let mut show_token_input = use_signal(|| false);
    let mut state = use_signal(|| State::Initial);
    let mut timetable = use_signal(|| None::<MergedTimeTable>);

    // Load token from localStorage on mount
    use_effect(move || {
        if api_token().is_empty() {
            if let Ok(stored_token) = LocalStorage::get::<String>("apiToken") {
                api_token.set(stored_token);
            } else {
                show_token_input.set(true);
            }
        }
    });

    let handle_token_submit = move |token: String| {
        let _ = LocalStorage::set("apiToken", &token);
        api_token.set(token);
        show_token_input.set(false);
    };

    let mut update_timetable = move || {
        let token = api_token();
        if token.is_empty() {
            return;
        }

        state.set(State::Loading);

        spawn(async move {
            let d = next_valid_date();
            info!("Fetching timetable for date: {}", format_date(&d));
            match get_timetables(&token, &d).await {
                Ok(tt) => {
                    info!("Successfully fetched timetable");
                    let merged = merge_subject_lists(format_date(&d), tt);
                    timetable.set(Some(merged));
                    state.set(State::Loaded);
                }
                Err(e) => {
                    info!("Error fetching timetable: {}", e);
                    state.set(State::Error);
                }
            }
        });
    };

    // Auto-refresh timetable
    use_effect(move || {
        let token = api_token();
        if !token.is_empty() {
            update_timetable();
            spawn(async move {
                loop {
                    TimeoutFuture::new(REFRESH_INTERVAL_MS).await;
                    update_timetable();
                }
            });
        }
    });

    // Auto-reload page
    use_effect(move || {
        spawn(async move {
            TimeoutFuture::new(RELOAD_INTERVAL_MS).await;
            if let Some(window) = web_sys::window() {
                let _ = window.location().reload();
            }
        });
    });

    // Request wake lock
    use_effect(move || {
        spawn(async move {
            if let Some(window) = web_sys::window() {
                let navigator = window.navigator();
                if let Ok(wake_lock) = js_sys::Reflect::get(&navigator, &"wakeLock".into()) {
                    if !wake_lock.is_undefined() {
                        let request_fn = js_sys::Reflect::get(&wake_lock, &"request".into());
                        if let Ok(request_fn) = request_fn {
                            if let Ok(request_fn) = request_fn.dyn_into::<js_sys::Function>() {
                                let _ = request_fn.call1(&wake_lock, &"screen".into());
                            }
                        }
                    }
                }
            }
        });
    });

    let tt = timetable();

    rsx! {
        {show_token_input().then(|| rsx! { TokenInput { on_submit: handle_token_submit } })}

        h1 {
            {if let Some(ref t) = tt {
                if t.is_today {
                    "Stundenplan"
                } else {
                    "Nächster Stundenplan"
                }
            } else {
                "Stundenplan"
            }}
        }

        h2 {
            {tt.as_ref().map(|t| {
                if let Ok(date) = chrono::NaiveDate::parse_from_str(&t.date, "%Y-%m-%d") {
                    date.format("%A, %-d. %B %Y").to_string()
                } else {
                    t.date.clone()
                }
            })}
        }

        {tt.as_ref().map(|t| rsx! {
            table { class: "timetable",
                thead {
                    tr {
                        th { "Stunde" }
                        {t.class_names.iter().map(|name| rsx! {
                            th { key: "{name}", "{name}" }
                        })}
                    }
                }
                tbody {
                    {t.hours.iter().map(|hour| {
                        let hour_num = hour.hour;
                        rsx! {
                            tr { key: "{hour_num}",
                                td { class: "hour",
                                    b { "{hour.hour}" }
                                    {hour.time.as_ref().map(|time| rsx! {
                                        br {}
                                        small { "{time.from}–{time.to}" }
                                    })}
                                }
                                {hour.subjects.iter().enumerate().map(|(idx, subject)| {
                                    let class_name = &t.class_names[idx];
                                    let key = format!("{}-{}", class_name, hour_num);
                                    let cancelled = subject.as_ref().map(|s| s.status == "canceled").unwrap_or(false);
                                    rsx! {
                                        td {
                                            key: "{key}",
                                            class: if cancelled { "subject cancelled" } else { "subject" },
                                            {subject.as_ref().map(|s| {
                                                let name = subject_name(s);
                                                let teachers = s.teachers.iter()
                                                    .map(|t| format!("{} {}", t.forename, t.name))
                                                    .collect::<Vec<_>>()
                                                    .join("/");
                                                let rooms = s.rooms.iter()
                                                    .map(|r| r.local_id.clone())
                                                    .collect::<Vec<_>>()
                                                    .join("/");

                                                rsx! {
                                                    b {
                                                        {if cancelled {
                                                            rsx! { s { "{name}" } }
                                                        } else {
                                                            rsx! { "{name}" }
                                                        }}
                                                    }
                                                    br {}
                                                    "{teachers}"
                                                    br {}
                                                    {(!rooms.is_empty()).then(|| rsx! {
                                                        small { "Raum {rooms}" }
                                                    })}
                                                }
                                            })}
                                        }
                                    }
                                })}
                            }
                        }
                    })}
                }
            }
        })}

        {tt.as_ref().and_then(|t| if !t.notes.is_empty() {
            Some(rsx! {
                p { class: "notes",
                    {t.notes.join(" • ")}
                }
            })
        } else {
            None
        })}

        p { class: "footer",
            {tt.as_ref().map(|t| format!("Zuletzt aktualisiert: {} — ", t.updated))}
            StateDisplay { state: state(), on_click: move |_| update_timetable() }
        }
    }
}

fn main() {
    dioxus_logger::init(Level::INFO).expect("failed to init logger");
    info!("starting app");
    launch(App);
}
