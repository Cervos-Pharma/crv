use log::{error, info};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    info!("Starting Cervos Pharmacy OS v0.1.1");

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            info!("Tauri app setup started");

            let main_window = app.get_webview_window("main").expect("main window not found");

            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    info!("Application close requested");
                }
            });

            main_window.show()?;
            info!("Main window shown");

            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(e) = result {
        error!("Tauri error: {:?}", e);
        std::process::exit(1);
    }
}
