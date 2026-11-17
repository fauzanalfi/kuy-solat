use crate::settings::{save_settings, AppSettings, ManualCoordinates};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationInfo {
    pub latitude: f64,
    pub longitude: f64,
    pub city: String,
    pub region: String,
    pub country: String,
}

impl Default for LocationInfo {
    fn default() -> Self {
        Self {
            latitude: -6.2088,
            longitude: 106.8456,
            city: "Jakarta".into(),
            region: "DKI Jakarta".into(),
            country: "Indonesia".into(),
        }
    }
}

fn cache_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.fauzan.kuysolat")
        .join("location-cache.json")
}

fn save_cache(location: &LocationInfo) {
    let path = cache_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(raw) = serde_json::to_string_pretty(location) {
        let _ = fs::write(path, raw);
    }
}

fn load_cache() -> LocationInfo {
    let path = cache_path();
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

#[derive(Deserialize)]
struct PhotonResponse {
    features: Vec<PhotonFeature>,
}

#[derive(Deserialize)]
struct PhotonFeature {
    geometry: PhotonGeometry,
    properties: PhotonProperties,
}

#[derive(Deserialize)]
struct PhotonGeometry {
    coordinates: Vec<f64>,
}

#[derive(Deserialize)]
struct PhotonProperties {
    name: Option<String>,
    state: Option<String>,
    country: Option<String>,
}

fn geocode_city(city_name: &str) -> Option<LocationInfo> {
    let url = format!(
        "https://photon.komoot.io/api/?q={}&limit=1&lang=en",
        urlencoding::encode(city_name)
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("KuySolat/2.0")
        .build()
        .ok()?;

    let response: PhotonResponse = client.get(url).send().ok()?.json().ok()?;
    let feature = response.features.into_iter().next()?;
    let lon = *feature.geometry.coordinates.first()?;
    let lat = *feature.geometry.coordinates.get(1)?;

    Some(LocationInfo {
        latitude: lat,
        longitude: lon,
        city: feature.properties.name.unwrap_or_else(|| city_name.to_string()),
        region: feature.properties.state.unwrap_or_default(),
        country: feature
            .properties
            .country
            .unwrap_or_else(|| "Indonesia".into()),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IpApiResponse {
    latitude: Option<f64>,
    longitude: Option<f64>,
    city_name: Option<String>,
    region_name: Option<String>,
    country_name: Option<String>,
}

fn detect_auto_location() -> LocationInfo {
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("KuySolat/2.0")
        .build()
    {
        Ok(c) => c,
        Err(_) => return load_cache(),
    };

    match client.get("https://freeipapi.com/api/json").send() {
        Ok(resp) => match resp.json::<IpApiResponse>() {
            Ok(json) => {
                if let (Some(lat), Some(lon)) = (json.latitude, json.longitude) {
                    let location = LocationInfo {
                        latitude: lat,
                        longitude: lon,
                        city: json
                            .city_name
                            .or(json.region_name.clone())
                            .unwrap_or_else(|| "Unknown".into()),
                        region: json.region_name.unwrap_or_default(),
                        country: json.country_name.unwrap_or_default(),
                    };
                    save_cache(&location);
                    return location;
                }
                load_cache()
            }
            Err(_) => load_cache(),
        },
        Err(_) => load_cache(),
    }
}

/// Resolve location based on current settings. Updates stored manual coordinates on success.
pub fn resolve_location(settings: &mut AppSettings) -> LocationInfo {
    if settings.location.location_type == "manual" {
        if let Some(coords) = geocode_city(&settings.location.manual_city) {
            settings.location.manual_coordinates = ManualCoordinates {
                latitude: coords.latitude,
                longitude: coords.longitude,
            };
            let _ = save_settings(settings);
            return coords;
        }

        return LocationInfo {
            latitude: settings.location.manual_coordinates.latitude,
            longitude: settings.location.manual_coordinates.longitude,
            city: settings.location.manual_city.clone(),
            region: "Manual".into(),
            country: "Indonesia".into(),
        };
    }

    detect_auto_location()
}
