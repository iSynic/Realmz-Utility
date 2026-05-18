use std::{
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    thread,
    time::Duration,
};

use base64::Engine;
use tauri::{path::BaseDirectory, Manager, WebviewUrl, WebviewWindowBuilder};

type LauncherResult<T> = Result<T, Box<dyn std::error::Error>>;

struct ServerProcess {
    child: Mutex<Option<Child>>,
}

impl ServerProcess {
    fn new(child: Child) -> Self {
        Self {
            child: Mutex::new(Some(child)),
        }
    }

    fn stop(&self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(mut child) = child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

impl Drop for ServerProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn run() {
    std::panic::set_hook(Box::new(|panic_info| {
        write_launcher_log(format!("panic: {panic_info}"));
    }));

    if let Err(error) = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            pick_scenarios_folder,
            save_exported_map_png
        ])
        .setup(|app| {
            let server = start_node_server(app)?;
            let server_url = server.url.clone();

            app.manage(ServerProcess::new(server.child));

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(server_url.parse()?))
                .title("Realmz Scenario Utility")
                .inner_size(1500.0, 950.0)
                .min_inner_size(1100.0, 720.0)
                .background_color((0x11, 0x13, 0x14, 0xff).into())
                .build()?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(server) = window.try_state::<ServerProcess>() {
                    server.stop();
                }
            }
        })
        .run(tauri::generate_context!())
    {
        write_launcher_log(format!("failed to run Realmz Scenario Utility: {error:?}"));
    }
}

#[tauri::command]
fn pick_scenarios_folder(initial_path: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_title("Locate Scenarios folder");

    if let Some(initial_dir) = initial_path
        .as_deref()
        .and_then(dialog_initial_directory)
        .map(normalize_windows_verbatim_path)
    {
        dialog = dialog.set_directory(initial_dir);
    }

    Ok(dialog
        .pick_folder()
        .map(normalize_windows_verbatim_path)
        .map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn save_exported_map_png(
    suggested_filename: String,
    png_base64: String,
) -> Result<Option<String>, String> {
    let filename = sanitize_export_filename(&suggested_filename);
    let Some(path) = rfd::FileDialog::new()
        .set_title("Export current map")
        .add_filter("PNG image", &["png"])
        .set_file_name(&filename)
        .save_file()
    else {
        return Ok(None);
    };

    let path = ensure_png_extension(normalize_windows_verbatim_path(path));
    let encoded = png_base64
        .trim()
        .strip_prefix("data:image/png;base64,")
        .unwrap_or_else(|| png_base64.trim());
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("Unable to decode exported PNG: {error}"))?;

    std::fs::write(&path, bytes)
        .map_err(|error| format!("Unable to write '{}': {error}", path.display()))?;

    Ok(Some(
        normalize_windows_verbatim_path(path)
            .to_string_lossy()
            .into_owned(),
    ))
}

struct StartedServer {
    child: Child,
    url: String,
}

fn start_node_server(app: &tauri::App) -> LauncherResult<StartedServer> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let server_script = normalize_windows_verbatim_path(find_server_script(app)?);
    let server_root = server_script
        .parent()
        .and_then(|path| path.parent())
        .ok_or_else(|| io_error("Unable to resolve the Realmz server root."))?;
    let scenario_root = std::env::var_os("REALMZ_SCENARIO_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| default_launcher_scenario_root(app));

    let mut command = Command::new("node");
    command
        .arg(&server_script)
        .current_dir(server_root)
        .env("PORT", "0")
        .env("REALMZ_UTILITY_DATA_DIR", &app_data_dir)
        .env("REALMZ_SCENARIO_ROOT", &scenario_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let mut child = command.spawn().map_err(|error| {
        io_error(format!(
            "Unable to start the Realmz Node server with '{}': {error}. Make sure Node.js 20 or newer is available on PATH.",
            server_script.display()
        ))
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io_error("Unable to capture server startup output."))?;

    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("[realmz-server] {line}");
                write_launcher_log(format!("server stderr: {line}"));
            }
        });
    }

    let (url_tx, url_rx) = mpsc::channel();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            eprintln!("[realmz-server] {line}");
            if let Some(url) = extract_server_url(&line) {
                let _ = url_tx.send(url);
                break;
            }
        }
    });

    let url = match url_rx.recv_timeout(Duration::from_secs(15)) {
        Ok(url) => url,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(io_error(format!(
                "Realmz server did not report a listening URL within 15 seconds: {error}"
            ))
            .into());
        }
    };

    Ok(StartedServer { child, url })
}

fn find_server_script(app: &tauri::App) -> LauncherResult<PathBuf> {
    #[cfg(debug_assertions)]
    {
        let project_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or_else(|| io_error("Unable to resolve the project root."))?
            .join("src")
            .join("server.mjs");

        if project_script.exists() {
            return Ok(project_script);
        }
    }

    let bundled_script = app
        .path()
        .resolve("src/server.mjs", BaseDirectory::Resource)?;
    if bundled_script.exists() {
        return Ok(bundled_script);
    }

    Err(io_error(format!(
        "Unable to find bundled src/server.mjs. Checked '{}'.",
        bundled_script.display()
    ))
    .into())
}

fn extract_server_url(line: &str) -> Option<String> {
    let start = line.find("http://")?;
    Some(line[start..].trim().trim_end_matches('/').to_string() + "/")
}

fn default_launcher_scenario_root(app: &tauri::App) -> PathBuf {
    launcher_dir(app).join("Scenarios")
}

fn launcher_dir(app: &tauri::App) -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .or_else(|| app.path().resource_dir().ok())
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

fn dialog_initial_directory(initial_path: &str) -> Option<PathBuf> {
    let trimmed = initial_path.trim();
    if trimmed.is_empty() {
        return None;
    }

    let path = PathBuf::from(trimmed);
    if path.is_dir() {
        return Some(path);
    }

    path.parent()
        .filter(|parent| parent.is_dir())
        .map(Path::to_path_buf)
}

fn sanitize_export_filename(filename: &str) -> String {
    let mut output = String::with_capacity(filename.len());
    for character in filename.trim().chars() {
        if character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
        {
            output.push('-');
        } else {
            output.push(character);
        }
    }

    let mut output = output
        .trim_matches(|character: char| character.is_whitespace() || character == '.' || character == '-')
        .to_string();
    if output.is_empty() {
        output = "realmz-map".to_string();
    }
    if !output.to_ascii_lowercase().ends_with(".png") {
        output.push_str(".png");
    }
    output
}

fn ensure_png_extension(path: PathBuf) -> PathBuf {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some(extension) if extension.eq_ignore_ascii_case("png") => path,
        _ => path.with_extension("png"),
    }
}

fn io_error(message: impl Into<String>) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, message.into())
}

fn normalize_windows_verbatim_path(path: PathBuf) -> PathBuf {
    let path_string = path.display().to_string();
    if let Some(stripped) = path_string.strip_prefix(r"\\?\") {
        PathBuf::from(stripped)
    } else {
        path
    }
}

fn write_launcher_log(message: impl AsRef<str>) {
    let path = std::env::temp_dir().join("realmz-scenario-utility-launcher.log");
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        use std::io::Write;
        let _ = writeln!(file, "{}", message.as_ref());
    }
}
