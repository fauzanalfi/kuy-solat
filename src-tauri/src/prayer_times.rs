use chrono::{Local, NaiveDate, Timelike, Utc};
use salah::prelude::*;
use serde::Serialize;

use crate::location::LocationInfo;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormattedTimes {
    pub subuh: String,
    pub terbit: String,
    pub dzuhur: String,
    pub ashar: String,
    pub maghrib: String,
    pub isya: String,
    pub raw: RawTimes,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawTimes {
    pub subuh: String,
    pub terbit: String,
    pub dzuhur: String,
    pub ashar: String,
    pub maghrib: String,
    pub isya: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NextPrayer {
    pub name: String,
    pub time: String,
    pub formatted: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrayerPayload {
    pub prayer_times: FormattedTimes,
    pub next_prayer: Option<NextPrayer>,
    pub current_prayer: Option<String>,
    pub location: LocationInfo,
}

fn kemenag_params() -> Parameters {
    let mut params = Configuration::new(20.0, 18.0)
        .madhab(Madhab::Shafi)
        .done();
    // Ihtiyat rata-rata 2 menit (setara implementasi Electron sebelumnya)
    params.adjustments = TimeAdjustment::new(2, 0, 2, 2, 2, 2);
    params
}

fn today_local() -> NaiveDate {
    Local::now().date_naive()
}

fn format_local(dt: chrono::DateTime<Utc>) -> String {
    let local = dt.with_timezone(&Local);
    format!("{:02}:{:02}", local.hour(), local.minute())
}

fn to_rfc3339(dt: chrono::DateTime<Utc>) -> String {
    dt.with_timezone(&Local).to_rfc3339()
}

fn prayer_times_for(date: NaiveDate, lat: f64, lon: f64) -> PrayerTimes {
    let coordinates = Coordinates::new(lat, lon);
    PrayerTimes::new(date, coordinates, kemenag_params())
}

fn display_name(prayer: Prayer) -> Option<&'static str> {
    match prayer {
        Prayer::Fajr | Prayer::FajrTomorrow => Some("Subuh"),
        Prayer::Sunrise => Some("Terbit"),
        Prayer::Dhuhr => Some("Dzuhur"),
        Prayer::Asr => Some("Ashar"),
        Prayer::Maghrib => Some("Maghrib"),
        Prayer::Isha => Some("Isya"),
        Prayer::Qiyam => None,
    }
}

pub fn get_formatted_prayer_times(lat: f64, lon: f64) -> FormattedTimes {
    let times = prayer_times_for(today_local(), lat, lon);
    FormattedTimes {
        subuh: format_local(times.time(Prayer::Fajr)),
        terbit: format_local(times.time(Prayer::Sunrise)),
        dzuhur: format_local(times.time(Prayer::Dhuhr)),
        ashar: format_local(times.time(Prayer::Asr)),
        maghrib: format_local(times.time(Prayer::Maghrib)),
        isya: format_local(times.time(Prayer::Isha)),
        raw: RawTimes {
            subuh: to_rfc3339(times.time(Prayer::Fajr)),
            terbit: to_rfc3339(times.time(Prayer::Sunrise)),
            dzuhur: to_rfc3339(times.time(Prayer::Dhuhr)),
            ashar: to_rfc3339(times.time(Prayer::Asr)),
            maghrib: to_rfc3339(times.time(Prayer::Maghrib)),
            isya: to_rfc3339(times.time(Prayer::Isha)),
        },
    }
}

/// Waktu shalat berikutnya di antara 6 waktu utama (setara perilaku Adhan.js sebelumnya).
pub fn get_next_prayer(lat: f64, lon: f64) -> Option<NextPrayer> {
    let now = Utc::now();
    let today = prayer_times_for(today_local(), lat, lon);

    let sequence = [
        Prayer::Fajr,
        Prayer::Sunrise,
        Prayer::Dhuhr,
        Prayer::Asr,
        Prayer::Maghrib,
        Prayer::Isha,
    ];

    for prayer in sequence {
        let time = today.time(prayer);
        if time > now {
            let name = display_name(prayer)?.to_string();
            return Some(NextPrayer {
                name,
                formatted: format_local(time),
                time: to_rfc3339(time),
            });
        }
    }

    // Sudah lewat Isya → Subuh besok
    let tomorrow = today_local() + chrono::Duration::days(1);
    let tomorrow_times = prayer_times_for(tomorrow, lat, lon);
    let fajr = tomorrow_times.time(Prayer::Fajr);
    Some(NextPrayer {
        name: "Subuh".into(),
        formatted: format_local(fajr),
        time: to_rfc3339(fajr),
    })
}

pub fn get_current_prayer(lat: f64, lon: f64) -> Option<String> {
    let now = Utc::now();
    let today = prayer_times_for(today_local(), lat, lon);

    let sequence = [
        (Prayer::Isha, "Isya"),
        (Prayer::Maghrib, "Maghrib"),
        (Prayer::Asr, "Ashar"),
        (Prayer::Dhuhr, "Dzuhur"),
        (Prayer::Sunrise, "Terbit"),
        (Prayer::Fajr, "Subuh"),
    ];

    for (prayer, name) in sequence {
        if now >= today.time(prayer) {
            return Some(name.to_string());
        }
    }

    None
}

pub fn build_payload(location: LocationInfo) -> PrayerPayload {
    let lat = location.latitude;
    let lon = location.longitude;
    PrayerPayload {
        prayer_times: get_formatted_prayer_times(lat, lon),
        next_prayer: get_next_prayer(lat, lon),
        current_prayer: get_current_prayer(lat, lon),
        location,
    }
}

pub fn upcoming_notification_targets(lat: f64, lon: f64) -> Vec<(String, chrono::DateTime<Utc>)> {
    let now = Utc::now();
    let today = prayer_times_for(today_local(), lat, lon);
    let prayers = [
        (Prayer::Fajr, "Subuh"),
        (Prayer::Dhuhr, "Dzuhur"),
        (Prayer::Asr, "Ashar"),
        (Prayer::Maghrib, "Maghrib"),
        (Prayer::Isha, "Isya"),
    ];

    prayers
        .into_iter()
        .filter_map(|(prayer, name)| {
            let time = today.time(prayer);
            if time > now {
                Some((name.to_string(), time))
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jakarta_times_are_populated() {
        let times = get_formatted_prayer_times(-6.2088, 106.8456);
        assert_eq!(times.subuh.len(), 5);
        assert_eq!(times.isya.len(), 5);
        assert!(times.raw.subuh.contains('T'));
    }

    #[test]
    fn next_prayer_always_exists() {
        let next = get_next_prayer(-6.2088, 106.8456);
        assert!(next.is_some());
        let name = next.unwrap().name;
        assert!(["Subuh", "Terbit", "Dzuhur", "Ashar", "Maghrib", "Isya"].contains(&name.as_str()));
    }
}
