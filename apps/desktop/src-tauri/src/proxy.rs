use axum::{
    extract::{Query},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
    body::Body,
};
use reqwest::Client;
use tower_http::cors::{Any, CorsLayer};
use tauri::{AppHandle, Manager, Emitter};

pub async fn start_proxy_server<F>(app_handle: AppHandle, shutdown_signal: F) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
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

    let app_handle_state = app_handle.clone();

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
        .with_state((client, app_handle_state));

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await?;
    Ok(())
}

#[derive(serde::Deserialize)]
struct ProxyParams {
    url: String,
    cookie: Option<String>,
    referer: Option<String>,
    hint: Option<String>,
    ua: Option<String>,
    filename: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, String>,
}


use reqwest::Url;

async fn proxy_handler(
    Query(params): Query<ProxyParams>,
    headers: HeaderMap,
    axum::extract::State((client, _app)): axum::extract::State<(Client, AppHandle)>,
) -> impl IntoResponse {
    let url = params.url;
    let cookie = params.cookie;
    let referer = params.referer.clone().unwrap_or_else(|| "https://pan.quark.cn/".to_string());

    let safe_url = url.chars().take(50).collect::<String>();
    println!("[Proxy] Requesting: {}...", safe_url);

    let user_agent = params.ua.clone().unwrap_or_else(|| {
        headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string())
    });
    
    println!("[Proxy] Using UA: {}", user_agent);
    println!("[Proxy] Using Referer: {}", referer);

    let mut req_builder = client.get(&url)
        .header("User-Agent", user_agent)
        .header("Referer", referer);

    if let Some(c) = &cookie {
        println!("[Proxy] Forwarding Cookie (len: {})", c.len());
        // Log start and end of cookie to verify it's not truncated
        let start = c.chars().take(20).collect::<String>();
        let end = c.chars().rev().take(20).collect::<String>().chars().rev().collect::<String>();
        println!("[Proxy] Cookie summary: {}...{}", start, end);
        req_builder = req_builder.header("Cookie", c);
    }

    // Forward custom headers from query parameters (high priority)
    for (name, val) in &params.extra {
        if name.starts_with("x-u-") {
            println!("[Proxy] Forwarding header from query: {} = {}", name, val);
            req_builder = req_builder.header(name, val);
        }
    }

    // Forward custom headers and quark auth headers from request headers
    for name in headers.keys() {
        let name_str = name.as_str();
        if name_str.starts_with("x-u-") || name_str == "range" || name_str == "if-range" {
            // Only add if not already added from query params
            if !params.extra.contains_key(name_str) {
                if let Some(val) = headers.get(name) {
                    println!("[Proxy] Forwarding header from request: {} = {:?}", name, val);
                    req_builder = req_builder.header(name, val);
                }
            }
        }
    }


    match req_builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            let mut response_builder = Response::builder().status(status);

            // Forward response headers (Exclude content-length to handle it manually)
            let headers_to_forward = [
                "content-range", "accept-ranges", 
                "cache-control", "etag", "last-modified", "expires", "pragma",
                "access-control-allow-origin", "access-control-expose-headers"
            ];
             for key in headers_to_forward {
                  if let Some(val) = resp.headers().get(key) {
                      response_builder = response_builder.header(key, val);
                      if key == "content-range" {
                          println!("[Proxy] Forwarding {}: {:?}", key, val);
                      }
                  }
             }

            // If error, read body as text for debugging
            if !status.is_success() && status != StatusCode::PARTIAL_CONTENT && status != StatusCode::NOT_MODIFIED {
                 let error_text = resp.text().await.unwrap_or_default();
                 println!("[Proxy] Error {}: {}", status, error_text);
                 return response_builder.body(Body::from(error_text)).unwrap();
            }

            // Check for m3u8 playlist or audio files
            let content_type = resp.headers().get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            
            // Try to deduce if it's audio from URL path or hint
            let hint = params.hint.unwrap_or_default().to_lowercase();
            let filename = params.filename.unwrap_or_default().to_lowercase();
            let mut is_audio = hint == "audio";
            
            if !is_audio {
                if let Ok(u) = Url::parse(&url) {
                    let path = u.path().to_lowercase();
                    is_audio = path.ends_with(".mp3") || 
                               path.ends_with(".flac") || 
                               path.ends_with(".wav") || 
                               path.ends_with(".m4a") ||
                               path.ends_with(".ogg");
                    
                    if !is_audio {
                        // Check explicit filename param first
                        if filename.ends_with(".mp3") || filename.ends_with(".flac") || filename.ends_with(".wav") || filename.ends_with(".m4a") || filename.ends_with(".ogg") {
                            is_audio = true;
                        } else {
                            // Check query params for filename (sometimes quark does this)
                            for (k, v) in u.query_pairs() {
                                if k == "filename" || k == "name" {
                                    let v = v.to_lowercase();
                                    if v.ends_with(".mp3") || v.ends_with(".flac") || v.ends_with(".wav") || v.ends_with(".m4a") || v.ends_with(".ogg") {
                                        is_audio = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if content_type.contains("application/vnd.apple.mpegurl") || content_type.contains("application/x-mpegurl") {
                // Buffer and rewrite m3u8
                match resp.text().await {
                    Ok(body) => {
                         let mut new_lines = Vec::new();
                         let base_url = Url::parse(&url).unwrap_or_else(|_| Url::parse("http://unknown").unwrap()); // Best effort
                         
                         for line in body.lines() {
                             let line = line.trim();
                             if line.is_empty() {
                                 new_lines.push(line.to_string());
                                 continue;
                             }
                             
                             if line.starts_with("#") {
                                 // Check for URI="..." in tags like #EXT-X-KEY
                                 if line.contains("URI=\"") {
                                     // Simple string replacement: find URI="..." and replace inside
                                     // This is a naive regex-like approach without regex crate
                                     if let Some(start) = line.find("URI=\"") {
                                         let rest = &line[start + 5..];
                                         if let Some(end) = rest.find("\"") {
                                            let uri_str = &rest[..end];
                                             if let Ok(abs_url) = base_url.join(uri_str) {
                                                let mut encoded_proxy_url = format!("proxy?url={}", urlencoding::encode(abs_url.as_str()));
                                                if let Some(c) = &cookie {
                                                     encoded_proxy_url.push_str(&format!("&cookie={}", urlencoding::encode(c)));
                                                }
                                                if let Some(ua) = &params.ua {
                                                     encoded_proxy_url.push_str(&format!("&ua={}", urlencoding::encode(ua)));
                                                }
                                                if let Some(rf) = &params.referer {
                                                     encoded_proxy_url.push_str(&format!("&referer={}", urlencoding::encode(rf)));
                                                }
                                                let new_line = format!("{}URI=\"{}\"{}", &line[..start + 5], encoded_proxy_url, &rest[end..]);
                                                new_lines.push(new_line);
                                             } else {
                                                new_lines.push(line.to_string());
                                            }
                                         } else {
                                             new_lines.push(line.to_string());
                                         }
                                     } else {
                                         new_lines.push(line.to_string());
                                     }
                                 } else {
                                     new_lines.push(line.to_string());
                                 }
                             } else {
                                 // This is a segment URI
                                  if let Ok(abs_url) = base_url.join(line) {
                                      let mut proxy_url = format!("proxy?url={}", urlencoding::encode(abs_url.as_str()));
                                      if let Some(c) = &cookie {
                                           proxy_url.push_str(&format!("&cookie={}", urlencoding::encode(c)));
                                      }
                                      if let Some(ua) = &params.ua {
                                           proxy_url.push_str(&format!("&ua={}", urlencoding::encode(ua)));
                                      }
                                      if let Some(rf) = &params.referer {
                                           proxy_url.push_str(&format!("&referer={}", urlencoding::encode(rf)));
                                      }
                                      new_lines.push(proxy_url);
                                  } else {
                                     new_lines.push(line.to_string());
                                 }
                             }
                         }
                         
                         let new_body = new_lines.join("\n");
                         println!("[Proxy] Rewrote m3u8 playlist ({} lines). Size: {}", new_lines.len(), new_body.len());
                         
                         // Update Content-Length
                         response_builder = response_builder.header("content-length", new_body.len().to_string());
                         return response_builder.body(Body::from(new_body)).unwrap();
                    }
                    Err(e) => {
                        println!("[Proxy] Failed to read m3u8 body: {}", e);
                         return response_builder.body(Body::from(format!("Proxy failed to read body: {}", e))).unwrap();
                    }
                }
            }

            // Stream body (Forward Content-Length for standard streams)
            if let Some(val) = resp.headers().get("content-length") {
                response_builder = response_builder.header("content-length", val);
            }

            // Fix Content-Type if needed
            let mut final_ct = if content_type.is_empty() || content_type == "application/octet-stream" { None } else { Some(content_type) };
            
            let lower_url = url.to_lowercase();
            let lower_filename = filename.to_lowercase();
            
            let deduced_ct = if lower_url.contains(".mp3") || lower_filename.ends_with(".mp3") || hint.contains("mp3") { Some("audio/mpeg") }
                else if lower_url.contains(".flac") || lower_filename.ends_with(".flac") || hint.contains("flac") { Some("audio/mpeg") }
                else if lower_url.contains(".wav") || lower_filename.ends_with(".wav") || hint.contains("wav") { Some("audio/wav") }
                else if lower_url.contains(".m4a") || lower_filename.ends_with(".m4a") || hint.contains("m4a") { Some("audio/mp4") }
                else if lower_url.contains(".ogg") || lower_filename.ends_with(".ogg") || hint.contains("ogg") { Some("audio/ogg") }
                else if lower_url.contains(".mp4") || lower_filename.ends_with(".mp4") || hint.contains("mp4") { Some("video/mp4") }
                else if lower_url.contains(".mkv") || lower_filename.ends_with(".mkv") || hint.contains("mkv") { Some("video/x-matroska") }
                else if is_audio { Some("audio/mpeg") }
                else { None };

            // For audio/video, we prefer our deduced content-type if the original is generic
            if let Some(ct) = deduced_ct {
                if final_ct.is_none() || final_ct == Some("application/octet-stream") || is_audio {
                    println!("[Proxy] Using Content-Type override: {} (orig: {:?})", ct, final_ct);
                    final_ct = Some(ct);
                }
            }

            if let Some(ct) = final_ct {
                response_builder = response_builder.header("content-type", ct);
            }
            
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
