mod proxy;

use std::sync::{Arc, Mutex};
use tokio::sync::Notify;
use tauri::Manager;

struct ProxyState {
    port: Mutex<u16>,
    restart_notify: Arc<Notify>,
}

#[tauri::command]
async fn get_proxy_port(app_handle: tauri::AppHandle) -> u16 {
    let state = app_handle.state::<ProxyState>();
    let start = std::time::Instant::now();
    loop {
        {
            let port = *state.port.lock().unwrap();
            if port > 0 {
                return port;
            }
        }
        if start.elapsed() > std::time::Duration::from_secs(10) {
            return 0;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}

#[tauri::command]
async fn restart_proxy(app_handle: tauri::AppHandle) {
    let state = app_handle.state::<ProxyState>();
    println!("[Rust] Restart requested via command");
    state.restart_notify.notify_waiters();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let restart_notify = Arc::new(Notify::new());
  let restart_notify_state = restart_notify.clone();
  
  tauri::Builder::default()
    .manage(ProxyState { port: Mutex::new(0), restart_notify: restart_notify_state })
    .invoke_handler(tauri::generate_handler![get_proxy_port, restart_proxy])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "ios")]
      app.handle().plugin(tauri_plugin_swipe_back_ios::init())?;
      
      let restart_notify_thread = restart_notify.clone();
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
          // ... comments ...
          
          loop {
            // Create a future that owns a clone of the Arc, so it is 'static
            let notify = restart_notify_thread.clone();
            let shutdown_signal = async move {
                notify.notified().await;
            };
            
            // Pass this future to start_proxy_server
            if let Err(e) = proxy::start_proxy_server(app_handle.clone(), shutdown_signal).await {
                eprintln!("Proxy server failed: {}", e);
            } else {
                 // Proxy server stopped (shutdown signal or clean exit)
            }
            
            // Allow the frontend to know the server is down by resetting the port
            {
                let state = app_handle.state::<ProxyState>();
                *state.port.lock().unwrap() = 0;
            }

            // If it returns, it means it stopped or crashed. Wait a bit and restart.
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            println!("Restarting proxy server...");
          }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
