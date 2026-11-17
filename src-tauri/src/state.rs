use parking_lot::Mutex;
use std::sync::Arc;
use std::thread::JoinHandle;

use crate::location::LocationInfo;
use crate::settings::AppSettings;

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub location: Mutex<LocationInfo>,
    pub settings_open: Mutex<bool>,
    pub notification_workers: Mutex<Vec<JoinHandle<()>>>,
    pub cancel_notifications: Mutex<Arc<std::sync::atomic::AtomicBool>>,
}

impl AppState {
    pub fn new(settings: AppSettings, location: LocationInfo) -> Self {
        Self {
            settings: Mutex::new(settings),
            location: Mutex::new(location),
            settings_open: Mutex::new(false),
            notification_workers: Mutex::new(Vec::new()),
            cancel_notifications: Mutex::new(Arc::new(std::sync::atomic::AtomicBool::new(false))),
        }
    }
}
