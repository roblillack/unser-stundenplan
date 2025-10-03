use chrono::{Datelike, Duration, NaiveDate, Timelike, Weekday};

pub type DateString = String;

pub fn format_date(date: &NaiveDate) -> DateString {
    date.format("%Y-%m-%d").to_string()
}

pub fn next_valid_date() -> NaiveDate {
    let now = chrono::Local::now();
    let mut d = now.date_naive();

    // If it's after 5 PM (17:00), move to next day
    if now.hour() >= 17 {
        d = d + Duration::days(1);
    }

    // Skip weekends
    while d.weekday() == Weekday::Sat || d.weekday() == Weekday::Sun {
        d = d + Duration::days(1);
    }

    d
}

pub fn calc_iso_week(date: &NaiveDate) -> u32 {
    date.iso_week().week()
}

pub fn calc_iso_year(date: &NaiveDate) -> i32 {
    date.iso_week().year()
}
