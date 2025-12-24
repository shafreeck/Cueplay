use axum::{
    extract::{Query},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, options, post},
    Router,
    body::Body,
};
use reqwest::Client;
use std::net::SocketAddr;
use std::collections::HashMap;
use tower_http::cors::{Any, CorsLayer};
use tauri::{AppHandle, Manager, Emitter};

pub async fn start_proxy_server(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Attempt to bind to port 3001 first, then fallback to 0 (random)
    // Actually, for consistency with local dev, we might want to try 3001.
    // But in packaged app, 3001 might be taken or we want robustness.
    // Let's try to bind to 0 to get a random port, and then tell frontend.
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0").await?;
    let port = listener.local_addr()?.port();
    
    println!("Proxy server listening on port: {}", port);

    // Update the state so `get_proxy_port` returns the correct port
    // Use state() to ensure we panic if state is missing, and to confirm it works
    let state = app_handle.state::<crate::ProxyState>();
    *state.port.lock().unwrap() = port;

    let _ = app_handle.emit("proxy-server-started", port);

    let client = Client::builder()
        .no_proxy()
        .build()?;

    let app = Router::new()
        .route("/ping", get(|| async { "pong" }))
        .route("/api/stream/proxy", get(proxy_handler).options(proxy_options))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::OPTIONS])
                .allow_headers(Any)
                .expose_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::CONTENT_LENGTH,
                    axum::http::header::CONTENT_RANGE,
                    axum::http::header::ACCEPT_RANGES,
                ]),
        )
        .with_state(client);

    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(serde::Deserialize)]
struct ProxyParams {
    url: String,
    cookie: Option<String>,
    referer: Option<String>,
}

async fn proxy_handler(
    Query(params): Query<ProxyParams>,
    headers: HeaderMap,
    axum::extract::State(client): axum::extract::State<Client>,
) -> impl IntoResponse {
    let url = params.url;
    let cookie = params.cookie;
    let referer = params.referer.unwrap_or_else(|| "https://pan.quark.cn/".to_string());

    println!("[Proxy] Requesting: {}...", &url.chars().take(50).collect::<String>());

    let user_agent = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string());

    let mut req_builder = client.get(&url)
        .header("User-Agent", user_agent)
        .header("Referer", referer);

    if let Some(c) = cookie {
        req_builder = req_builder.header("Cookie", c);
    }

    // Forward conditional headers
    let forward_headers = ["range", "if-range", "if-match", "if-none-match", "if-modified-since", "if-unmodified-since"];
    for key in forward_headers {
        if let Some(val) = headers.get(key) {
            req_builder = req_builder.header(key, val);
        }
    }

    match req_builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            let mut response_builder = Response::builder().status(status);

            // Forward response headers
            let headers_to_forward = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control", "etag", "last-modified"];
            for key in headers_to_forward {
                 if let Some(val) = resp.headers().get(key) {
                     response_builder = response_builder.header(key, val);
                 }
            }

            // If error, read body as text for debugging
            if !status.is_success() && status != StatusCode::PARTIAL_CONTENT {
                 let error_text = resp.text().await.unwrap_or_default();
                 println!("[Proxy] Error {}: {}", status, error_text);
                 return response_builder.body(Body::from(error_text)).unwrap();
            }

            // Stream body
            println!("[Proxy] Success: {}", status);
            response_builder.body(Body::from_stream(resp.bytes_stream())).unwrap()
        }
        Err(e) => {
            println!("[Proxy] Request Failed: {}", e);
             Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from(format!("Proxy failed: {}", e)))
                .unwrap()
        }
    }
}

async fn proxy_options() -> impl IntoResponse {
    StatusCode::NO_CONTENT
}
