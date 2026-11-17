mod location;
mod notifications;
mod prayer_times;
mod settings;
mod state;

use location::resolve_location;
use notifications::schedule_notifications;
use prayer_times::{build_payload, PrayerPayload};
use settings::{load_settings, save_settings, AppSettings};
use state::AppState;

use chrono::TimeZone;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartExt};
use tauri_plugin_dialog::DialogExt;

fn emit_prayer_data(app: &AppHandle) {
    let state = app.state::<AppState>();
    let location = state.location.lock().clone();
    let payload = build_payload(location);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("prayer-data", payload);
    }
    update_tray_tooltip(app);
}

fn update_tray_tooltip(app: &AppHandle) {
    let state = app.state::<AppState>();
    let location = state.location.lock().clone();
    let payload = build_payload(location.clone());

    let tooltip = if let Some(next) = payload.next_prayer {
        let now = chrono::Local::now();
        if let Ok(target) = chrono::DateTime::parse_from_rfc3339(&next.time) {
            let diff = target.with_timezone(&chrono::Local).signed_duration_since(now);
            let hours = diff.num_hours();
            let minutes = diff.num_minutes() % 60;
            let countdown = if hours > 0 {
                format!("{hours}j {minutes}m lagi")
            } else {
                format!("{minutes}m lagi")
            };
            format!(
                "🕌 Kuy Solat\n{}: {} ({})\n📍 {}",
                next.name, next.formatted, countdown, location.city
            )
        } else {
            format!("🕌 Kuy Solat\n📍 {}", location.city)
        }
    } else {
        "🕌 Kuy Solat".into()
    };

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn refresh_all(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut settings = state.settings.lock().clone();
    let location = resolve_location(&mut settings);
    *state.settings.lock() = settings;
    *state.location.lock() = location;
    schedule_notifications(app, &state);
    emit_prayer_data(app);
}

fn position_near_tray<R: Runtime>(window: &WebviewWindow<R>, tray_pos: PhysicalPosition<f64>) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let work = monitor.work_area();
    let Ok(size) = window.outer_size() else {
        return;
    };

    let mut x = (tray_pos.x as i32) - (size.width as i32 / 2);
    let mut y = (tray_pos.y as i32) - (size.height as i32) - 8;

    let work_x = work.position.x;
    let work_y = work.position.y;
    let work_w = work.size.width as i32;
    let work_h = work.size.height as i32;

    if x + size.width as i32 > work_x + work_w {
        x = work_x + work_w - size.width as i32 - 8;
    }
    if x < work_x {
        x = work_x + 8;
    }
    if y < work_y {
        y = (tray_pos.y as i32) + 24;
    }
    if y + size.height as i32 > work_y + work_h {
        y = work_y + work_h - size.height as i32 - 8;
    }

    let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
}

fn toggle_window(app: &AppHandle, tray_pos: Option<PhysicalPosition<f64>>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }

    if let Some(pos) = tray_pos {
        position_near_tray(&window, pos);
    }

    let _ = window.show();
    let _ = window.set_focus();
    emit_prayer_data(app);
}

#[tauri::command]
fn get_prayer_data(state: tauri::State<'_, AppState>) -> PrayerPayload {
    let location = state.location.lock().clone();
    build_payload(location)
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> AppSettings {
    state.settings.lock().clone()
}

#[tauri::command]
fn set_settings_open(open: bool, state: tauri::State<'_, AppState>) {
    *state.settings_open.lock() = open;
}

#[tauri::command]
fn save_app_settings(
    app: AppHandle,
    new_settings: AppSettings,
    state: tauri::State<'_, AppState>,
) -> Result<AppSettings, String> {
    let mut settings = new_settings;
    let location = resolve_location(&mut settings);
    save_settings(&settings)?;
    *state.settings.lock() = settings.clone();
    *state.location.lock() = location;
    *state.settings_open.lock() = false;

    let manager = app.autolaunch();
    if settings.auto_start {
        let _ = manager.enable();
    } else {
        let _ = manager.disable();
    }

    schedule_notifications(&app, &state);
    emit_prayer_data(&app);
    Ok(settings)
}

#[tauri::command]
fn get_hijri_offset(state: tauri::State<'_, AppState>) -> i32 {
    state.settings.lock().hijri_offset
}

#[tauri::command]
fn set_hijri_offset(offset: i32, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock().clone();
    settings.hijri_offset = offset;
    save_settings(&settings)?;
    *state.settings.lock() = settings;
    Ok(())
}

#[tauri::command]
fn hide_window(app: AppHandle, state: tauri::State<'_, AppState>) {
    if *state.settings_open.lock() {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn refresh_data(app: AppHandle) {
    refresh_all(&app);
}

#[tauri::command]
async fn pick_audio_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("Audio", &["mp3", "wav", "ogg"])
        .set_title("Pilih File Audio Adzan")
        .pick_file(move |file| {
            let _ = tx.send(file.map(|f| f.to_string()));
        });

    Ok(rx.recv().unwrap_or(None))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let settings = load_settings();
    let location = {
        let mut s = settings.clone();
        resolve_location(&mut s)
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            toggle_window(app, None);
        }))
        .manage(AppState::new(settings, location))
        .invoke_handler(tauri::generate_handler![
            get_prayer_data,
            get_settings,
            save_app_settings,
            get_hijri_offset,
            set_hijri_offset,
            hide_window,
            refresh_data,
            pick_audio_file,
            set_settings_open
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Autostart sesuai settings
            {
                let state = app.state::<AppState>();
                let auto = state.settings.lock().auto_start;
                let manager = app.autolaunch();
                if auto {
                    let _ = manager.enable();
                }
            }

            let show_i = MenuItem::with_id(app, "show", "📋 Tampilkan Jadwal", true, None::<&str>)?;
            let refresh_i =
                MenuItem::with_id(app, "refresh", "🔄 Refresh Lokasi", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "❌ Keluar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &refresh_i, &quit_i])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .unwrap_or_else(|| Image::from_bytes(include_bytes!("../icons/icon.png")).expect("icon"));

            let _tray = TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Kuy Solat")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_window(app, None),
                    "refresh" => refresh_all(app),
                    "quit" => {
                        let state = app.state::<AppState>();
                        notifications::clear_scheduled(&state);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        toggle_window(
                            app,
                            Some(PhysicalPosition {
                                x: position.x,
                                y: position.y,
                            }),
                        );
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let app_handle = handle.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let state = app_handle.state::<AppState>();
                        if *state.settings_open.lock() {
                            return;
                        }
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            schedule_notifications(&handle, app.state::<AppState>().inner());
            emit_prayer_data(&handle);

            // Sinkron tooltip tiap menit
            let tick_handle = handle.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(60));
                update_tray_tooltip(&tick_handle);
            });

            // Refresh harian sekitar 00:01
            let daily_handle = handle.clone();
            std::thread::spawn(move || loop {
                let now = chrono::Local::now();
                let tomorrow = (now.date_naive() + chrono::Duration::days(1))
                    .and_hms_opt(0, 1, 0)
                    .unwrap();
                let target = chrono::Local
                    .from_local_datetime(&tomorrow)
                    .single()
                    .unwrap_or(now);
                let wait = target.signed_duration_since(now);
                if wait.num_milliseconds() > 0 {
                    std::thread::sleep(std::time::Duration::from_millis(
                        wait.num_milliseconds() as u64,
                    ));
                }
                refresh_all(&daily_handle);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kuy Solat");
}
