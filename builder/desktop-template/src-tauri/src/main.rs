// Aplikasi desktop (Windows/macOS/Linux) yang dibuat Apkify dengan Tauri 2.
// Konfigurasi ditulis builder ke apkify.json lalu disematkan saat kompilasi.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Rule {
    pattern: String,
    action: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Cfg {
    name: String,
    start_url: String,
    local: bool,
    width: f64,
    height: f64,
    resizable: bool,
    fullscreen: bool,
    always_on_top: bool,
    maximized: bool,
    external_links_in_browser: bool,
    #[serde(default)]
    user_agent: Option<String>,
    #[serde(default)]
    link_rules: Vec<Rule>,
    #[serde(default)]
    custom_css: String,
    #[serde(default)]
    custom_js: String,
    #[serde(default)]
    app_json: String,
}

/// Skrip yang dijalankan sebelum halaman: window.APKIFY, CSS & JS kustom.
fn init_script(cfg: &Cfg) -> String {
    let css = serde_json::to_string(&cfg.custom_css).unwrap_or_else(|_| "\"\"".into());
    let app = if cfg.app_json.is_empty() { "{}".to_string() } else { cfg.app_json.clone() };
    format!(
        "window.APKIFY = Object.assign({app}, {{ platform: 'desktop' }});\n\
         (function(){{ var css = {css}; if (!css) return; var add = function(){{ var s=document.createElement('style'); s.textContent=css; (document.head||document.documentElement).appendChild(s); }}; if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', add); else add(); }})();\n\
         {js}",
        app = app,
        css = css,
        js = if cfg.custom_js.is_empty() { String::new() } else { format!("document.addEventListener('DOMContentLoaded', function(){{ try {{ {} }} catch(e) {{ console.error(e); }} }});", cfg.custom_js) }
    )
}

fn main() {
    let cfg: Cfg = serde_json::from_str(include_str!("../apkify.json")).expect("apkify.json tidak valid");

    tauri::Builder::default()
        .setup(move |app| {
            let url = if cfg.local {
                WebviewUrl::App("index.html".into())
            } else {
                WebviewUrl::External(cfg.start_url.parse().expect("URL awal tidak valid"))
            };
            let start_host = Url::parse(&cfg.start_url)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_string()))
                .unwrap_or_default();
            let rules: Vec<(regex::Regex, String)> = cfg
                .link_rules
                .iter()
                .filter_map(|r| regex::Regex::new(&r.pattern).ok().map(|re| (re, r.action.clone())))
                .collect();
            let external = cfg.external_links_in_browser;
            let local = cfg.local;

            let mut builder = WebviewWindowBuilder::new(app, "main", url)
                .title(&cfg.name)
                .inner_size(cfg.width, cfg.height)
                .resizable(cfg.resizable)
                .fullscreen(cfg.fullscreen)
                .always_on_top(cfg.always_on_top)
                .maximized(cfg.maximized)
                .initialization_script(&init_script(&cfg))
                .on_navigation(move |u: &Url| {
                    let s = u.as_str();
                    // Aturan link kustom (regex) didahulukan
                    for (re, action) in &rules {
                        if re.is_match(s) {
                            return match action.as_str() {
                                "internal" => true,
                                "block" => false,
                                _ => {
                                    let _ = open::that(s);
                                    false
                                }
                            };
                        }
                    }
                    match u.scheme() {
                        "http" | "https" => {}
                        "tauri" | "asset" | "about" | "data" | "blob" => return true,
                        _ => {
                            // mailto:, tel:, whatsapp:, dll. -> aplikasi bawaan OS
                            let _ = open::that(s);
                            return false;
                        }
                    }
                    let host = u.host_str().unwrap_or("");
                    let internal = if local {
                        host == "localhost" || host == "tauri.localhost"
                    } else {
                        host == start_host
                            || host.ends_with(&format!(".{}", start_host))
                            || start_host.ends_with(&format!(".{}", host))
                    };
                    if !internal && external {
                        let _ = open::that(s);
                        return false;
                    }
                    true
                });
            if let Some(ua) = &cfg.user_agent {
                if !ua.is_empty() {
                    builder = builder.user_agent(ua);
                }
            }
            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi");
}
