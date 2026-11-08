mod auth;
mod commands;
mod db;
mod http;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;
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
