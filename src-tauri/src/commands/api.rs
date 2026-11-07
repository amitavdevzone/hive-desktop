use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};

use crate::{
    auth,
    http::{ApiError, send},
};

/// The only network path for the frontend. A 401 means the token is dead:
/// drop it and tell the UI to show login.
#[tauri::command]
pub async fn api_request(
    app: AppHandle,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<Value, ApiError> {
    let result = send(&app, &method, &path, body, true).await;
    if matches!(&result, Err(e) if e.status == Some(401)) {
        let _ = auth::delete_token();
        let _ = app.emit("auth-expired", ());
    }
    result
}

/// Credentials go straight to the API and are dropped; only the token is kept,
/// in the keychain, and it is never returned.
#[tauri::command]
pub async fn login(app: AppHandle, email: String, password: String) -> Result<(), ApiError> {
    let res = send(
        &app,
        "POST",
        "/api/login",
        Some(json!({ "email": email, "password": password })),
        false,
    )
    .await?;
    let token = res
        .get("access_token")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::msg("Unexpected response from server"))?;
    auth::set_token(token).map_err(|e| ApiError::msg(&e))
}

#[tauri::command]
pub fn is_authenticated() -> bool {
    matches!(auth::get_token(), Ok(Some(_)))
}
