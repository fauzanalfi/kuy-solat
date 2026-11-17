use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualCoordinates {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationSettings {
    #[serde(rename = "type")]
    pub location_type: String,
    pub manual_city: String,
    pub manual_coordinates: ManualCoordinates,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MutedPrayers {
    pub subuh: bool,
    pub terbit: bool,
    pub dzuhur: bool,
    pub ashar: bool,
    pub maghrib: bool,
    pub isya: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSettings {
    pub enabled: bool,
    pub file: String,
    pub muted: MutedPrayers,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub location: LocationSettings,
    pub audio: AudioSettings,
    pub auto_start: bool,
    pub theme: String,
    pub hijri_offset: i32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            location: LocationSettings {
                location_type: "auto".into(),
                manual_city: "Jakarta".into(),
                manual_coordinates: ManualCoordinates {
                    latitude: -6.2088,
                    longitude: 106.8456,
                },
            },
            audio: AudioSettings {
                enabled: true,
                file: "default".into(),
                muted: MutedPrayers::default(),
            },
            auto_start: false,
            theme: "default".into(),
            hijri_offset: 0,
        }
    }
}

fn settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.fauzan.kuysolat")
        .join("settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = settings_path();
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}
