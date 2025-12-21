mod proxy;

use std::sync::Mutex;
use tauri::{State, Manager};

struct ProxyState {
    port: Mutex<u16>,
}

#[tauri::command]
fn get_proxy_port(state: State<ProxyState>) -> u16 {
    *state.port.lock().unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ProxyState { port: Mutex::new(0) })
    .invoke_handler(tauri::generate_handler![get_proxy_port])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
          // We need a way to get the port back from start_proxy_server
          // Since proxy::start_proxy_server binds internally, we should modify it to return the port or update state.
          // Let's modify proxy.rs slightly to accept state or return port, but start_proxy_server blocks.
          // Better: bind listener in run, pass listener to proxy::serve_proxy.
          
          // Actually, let's redefine the proxy interface in proxy.rs.
          // But for now, let's assume we fix proxy.rs in the next step to return the port or update state.
          // To make it simple: pass the State to start_proxy_server? No, State is tauri managed.
          // Let's pass the Arc<Mutex<u16>>?
          
          proxy::start_proxy_server(app_handle).await;
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
