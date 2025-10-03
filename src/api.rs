use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::dates::{calc_iso_week, calc_iso_year, format_date};
use chrono::NaiveDate;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WeekJournalReply {
    pub data: Data,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Data {
    #[serde(default)]
    pub days: Vec<Day>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Day {
    pub id: String,
    pub date: String,
    #[serde(default)]
    pub lessons: Vec<Lesson>,
    #[serde(default)]
    pub notes: Vec<Notes>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Notes {
    pub id: Option<String>,
    #[serde(rename = "for", default)]
    pub for_field: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub description: String,
    pub notable_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Teacher {
    pub id: Option<i32>,
    #[serde(default)]
    pub local_id: String,
    #[serde(default)]
    pub forename: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Subject {
    #[serde(rename = "for", default)]
    pub for_field: String,
    pub id: Option<i32>,
    #[serde(default)]
    pub local_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Time {
    pub id: Option<i32>,
    pub nr: i32,
    #[serde(default)]
    pub from: String,
    #[serde(default)]
    pub to: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Lesson {
    pub id: Option<i32>,
    pub nr: i32,
    pub group: Group,
    pub subject: Subject,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub rooms: Vec<Room>,
    #[serde(default)]
    pub teachers: Vec<Teacher>,
    pub time: Time,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Group {
    pub id: Option<i32>,
    #[serde(default)]
    pub local_id: String,
    #[serde(default)]
    pub level_id: i32,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Room {
    pub id: Option<i32>,
    #[serde(default)]
    pub local_id: String,
}

#[derive(Debug, Clone)]
pub struct SubjectList {
    pub class_name: String,
    pub subjects: Vec<Lesson>,
}

#[derive(Debug, Clone)]
pub struct TimeTable {
    pub times: HashMap<i32, Time>,
    pub classes: Vec<SubjectList>,
    pub notes: Vec<Notes>,
    pub actual_date: NaiveDate,
    pub days_off_before: i32,
}

async fn fetch_week_data(api_token: &str, date: &NaiveDate) -> Result<WeekJournalReply, String> {
    let iso_week = calc_iso_week(date);
    let iso_year = calc_iso_year(date);
    let iso_week_str = format!("{}-{}", iso_year, iso_week);

    let url = format!(
        "https://beste.schule/api/journal/weeks/{}?include=days.lessons&interpolate=true",
        iso_week_str
    );

    web_sys::console::log_1(&format!("Fetching URL: {}", url).into());

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_token))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    web_sys::console::log_1(&format!("Response status: {}", status).into());

    let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    web_sys::console::log_1(&format!("Response body length: {}", text.len()).into());

    // Log the section around the error to see what's actually there
    let error_pos = 7935;
    if text.len() > error_pos {
        let start = error_pos.saturating_sub(100);
        let end = (error_pos + 100).min(text.len());
        web_sys::console::log_1(&format!("JSON around position 7935: {}", &text[start..end]).into());
    }

    let reply: WeekJournalReply = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse JSON: {} - Body preview: {}", e, &text[..text.len().min(200)]))?;

    Ok(reply)
}

fn extract_day_from_week(week_data: &WeekJournalReply, date: &NaiveDate) -> (HashMap<i32, Time>, Vec<SubjectList>, Vec<Notes>) {
    let date_str = format_date(date);
    let mut lessons_by_level: HashMap<i32, Vec<Lesson>> = HashMap::new();
    let mut names_by_level: HashMap<i32, String> = HashMap::new();
    let mut times_by_number: HashMap<i32, Time> = HashMap::new();
    let mut notes: Vec<Notes> = Vec::new();

    for day in &week_data.data.days {
        if day.date != date_str {
            continue;
        }

        notes = day.notes.clone();

        for lesson in &day.lessons {
            // Skip lessons with invalid data (null level_id or nr)
            if lesson.group.level_id == 0 || lesson.nr == 0 {
                web_sys::console::log_1(&format!("Skipping lesson with invalid data: level_id={}, nr={}", lesson.group.level_id, lesson.nr).into());
                continue;
            }

            lessons_by_level
                .entry(lesson.group.level_id)
                .or_insert_with(Vec::new)
                .push(lesson.clone());

            // Determine class name by finding common prefix
            names_by_level
                .entry(lesson.group.level_id)
                .and_modify(|name| {
                    let mut common = String::new();
                    for (i, c) in lesson.group.local_id.chars().enumerate() {
                        if name.chars().nth(i) == Some(c) {
                            common.push(c);
                        } else {
                            break;
                        }
                    }
                    *name = common;
                })
                .or_insert_with(|| lesson.group.local_id.clone());

            times_by_number
                .entry(lesson.nr)
                .or_insert(lesson.time.clone());
        }
    }

    let mut classes: Vec<SubjectList> = Vec::new();
    for (level, mut lessons) in lessons_by_level {
        lessons.sort_by_key(|l| l.nr);
        classes.push(SubjectList {
            class_name: names_by_level.get(&level).cloned().unwrap_or_default(),
            subjects: lessons,
        });
    }

    (times_by_number, classes, notes)
}

pub async fn get_timetables(api_token: &str, date: &NaiveDate) -> Result<TimeTable, String> {
    use chrono::Duration;
    use chrono::Datelike;
    use chrono::Weekday;

    // Fetch the initial week
    let week_data = fetch_week_data(api_token, date).await?;
    let (times, classes, notes) = extract_day_from_week(&week_data, date);

    // Check if this day has any lessons
    let has_lessons = !classes.is_empty() && classes.iter().any(|c| !c.subjects.is_empty());

    if has_lessons {
        // Normal school day
        return Ok(TimeTable {
            times,
            notes,
            classes,
            actual_date: *date,
            days_off_before: 0,
        });
    }

    // Holiday detected - search up to 3 weeks (21 days) for next school day
    web_sys::console::log_1(&"No lessons found, searching for next school day...".into());

    let original_date = *date;
    let mut search_date = *date + Duration::days(1);
    let max_search_date = *date + Duration::days(21);

    // Cache weeks we've already fetched, keyed by ISO week string
    let mut week_cache: HashMap<String, WeekJournalReply> = HashMap::new();
    let initial_week_key = format!("{}-{}", calc_iso_year(date), calc_iso_week(date));
    week_cache.insert(initial_week_key, week_data);

    while search_date <= max_search_date {
        // Skip weekends for searching
        if search_date.weekday() == Weekday::Sat || search_date.weekday() == Weekday::Sun {
            search_date = search_date + Duration::days(1);
            continue;
        }

        web_sys::console::log_1(&format!("Checking date: {}", format_date(&search_date)).into());

        // Check if we need to fetch this week's data
        let week_key = format!("{}-{}", calc_iso_year(&search_date), calc_iso_week(&search_date));
        if !week_cache.contains_key(&week_key) {
            web_sys::console::log_1(&format!("Fetching new week: {}", week_key).into());
            match fetch_week_data(api_token, &search_date).await {
                Ok(data) => {
                    week_cache.insert(week_key.clone(), data);
                }
                Err(e) => {
                    web_sys::console::log_1(&format!("Error fetching week {}: {}", week_key, e).into());
                    search_date = search_date + Duration::days(1);
                    continue;
                }
            }
        }

        // Extract the day from the cached week
        if let Some(week_data) = week_cache.get(&week_key) {
            let (next_times, next_classes, next_notes) = extract_day_from_week(week_data, &search_date);
            let next_has_lessons = !next_classes.is_empty() && next_classes.iter().any(|c| !c.subjects.is_empty());

            if next_has_lessons {
                // Calculate total days off including weekends
                let days_off = (search_date - original_date).num_days() as i32;
                web_sys::console::log_1(&format!("Found next school day: {} (days off: {})", format_date(&search_date), days_off).into());
                return Ok(TimeTable {
                    times: next_times,
                    notes: next_notes,
                    classes: next_classes,
                    actual_date: search_date,
                    days_off_before: days_off,
                });
            }
        }

        search_date = search_date + Duration::days(1);
    }

    // If we couldn't find a school day within 3 weeks, return the empty timetable
    web_sys::console::log_1(&"No school day found within 3 weeks".into());
    Ok(TimeTable {
        times,
        notes,
        classes,
        actual_date: original_date,
        days_off_before: 0,
    })
}
