use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::prayer_times::upcoming_notification_targets;
use crate::settings::AppSettings;
use crate::state::AppState;

pub fn clear_scheduled(state: &AppState) {
    state
        .cancel_notifications
        .lock()
        .store(true, Ordering::SeqCst);
    let mut workers = state.notification_workers.lock();
    workers.clear();
    *state.cancel_notifications.lock() = Arc::new(AtomicBool::new(false));
}

pub fn schedule_notifications(app: &AppHandle, state: &AppState) {
    clear_scheduled(state);

    let cancel = state.cancel_notifications.lock().clone();
    let location = state.location.lock().clone();
    let settings = state.settings.lock().clone();
    let targets = upcoming_notification_targets(location.latitude, location.longitude);

    let mut workers = state.notification_workers.lock();
    for (name, when) in targets {
        let app = app.clone();
        let cancel = cancel.clone();
        let settings = settings.clone();
        let name_for_thread = name.clone();

        let handle = thread::spawn(move || {
            let now = chrono::Utc::now();
            let wait = when.signed_duration_since(now);
            if wait.num_milliseconds() <= 0 {
                return;
            }

            let total_ms = wait.num_milliseconds() as u64;
            let slice = 1000u64;
            let mut waited = 0u64;
            while waited < total_ms {
                if cancel.load(Ordering::SeqCst) {
                    return;
                }
                let step = (total_ms - waited).min(slice);
                thread::sleep(Duration::from_millis(step));
                waited += step;
            }

            if cancel.load(Ordering::SeqCst) {
                return;
            }

            show_prayer_notification(&app, &settings, &name_for_thread, when);
        });

        workers.push(handle);
    }
}

fn show_prayer_notification(
    app: &AppHandle,
    settings: &AppSettings,
    prayer_name: &str,
    when: chrono::DateTime<chrono::Utc>,
) {
    let time_str = when
        .with_timezone(&chrono::Local)
        .format("%H:%M")
        .to_string();

    let _ = app
        .notification()
        .builder()
        .title(format!("🕌 Waktu {prayer_name}"))
        .body(format!(
            "Sudah masuk waktu {prayer_name} ({time_str}). Ayo segera shalat!"
        ))
        .show();

    if settings.audio.enabled {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit(
                "play-adzan",
                serde_json::json!({
                    "file": settings.audio.file,
                    "prayerName": prayer_name.to_lowercase()
                }),
            );
        }
    }
}
