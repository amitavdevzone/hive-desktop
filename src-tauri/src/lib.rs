mod auth;
mod commands;
mod db;
mod http;
mod reminders;
mod sync;

use tauri::{
    AppHandle, Manager,
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::TrayIconBuilder,
};

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            use tauri_plugin_notification::NotificationExt;
            // macOS asks the user once; elsewhere this is a no-op grant.
            let _ = app.notification().request_permission();
            let path = app.path().app_data_dir()?.join("hive.db");
            app.manage(db::open(&path)?);
            reminders::start(app.handle().clone());

            // Tray keeps the app (and the reminder scheduler) alive with the window hidden.
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let notif = CheckMenuItem::with_id(
                app,
                "notifications",
                "Notifications",
                true,
                commands::settings::notifications_enabled(app.handle()),
                None::<&str>,
            )?;
            let notif_item = notif.clone();
            let mut tray = TrayIconBuilder::new()
                .menu(&Menu::with_items(app, &[&notif, &show, &quit])?)
                .on_menu_event(move |app, e| match e.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    // The item flips its own check mark on click; persist what it shows.
                    "notifications" => {
                        let _ = commands::settings::set_notifications(
                            app,
                            notif_item.is_checked().unwrap_or(true),
                        );
                    }
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::api::api_request,
            commands::api::login,
            commands::api::is_authenticated,
            commands::settings::get_base_url,
            commands::settings::set_base_url,
            commands::settings::get_auto_sync,
            commands::settings::set_auto_sync,
            commands::notes::list_notes,
            commands::notes::get_note,
            commands::notes::sync_now,
            commands::notes::create_note,
            commands::notes::save_note,
            commands::notes::delete_note,
            commands::notes::list_tag_names,
            commands::reminders::refresh_reminders,
            commands::reminders::reminder_last_fired
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
