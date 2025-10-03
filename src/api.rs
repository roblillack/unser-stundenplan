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
}

pub async fn get_timetables(api_token: &str, date: &NaiveDate) -> Result<TimeTable, String> {
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

    let date_str = format_date(date);
    let mut lessons_by_level: HashMap<i32, Vec<Lesson>> = HashMap::new();
    let mut names_by_level: HashMap<i32, String> = HashMap::new();
    let mut times_by_number: HashMap<i32, Time> = HashMap::new();
    let mut notes: Vec<Notes> = Vec::new();

    for day in reply.data.days {
        if day.date != date_str {
            continue;
        }

        notes = day.notes;

        for lesson in day.lessons {
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

    Ok(TimeTable {
        times: times_by_number,
        notes,
        classes,
    })
}
