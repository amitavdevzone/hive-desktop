mod auth;
mod commands;
mod db;
mod http;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            use tauri::Manager;
            use tauri_plugin_notification::NotificationExt;
            // macOS asks the user once; elsewhere this is a no-op grant.
            let _ = app.notification().request_permission();
            let path = app.path().app_data_dir()?.join("hive.db");
            app.manage(db::open(&path)?);
            Ok(())
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
            commands::notes::list_tag_names
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
