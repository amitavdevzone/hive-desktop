//! The single HTTP path to the Laravel API. Callers pass a method and a
//! relative path only; the base URL and bearer token are added here.
use std::{collections::HashMap, sync::OnceLock, time::Duration};

use reqwest::{Client, Method};
use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use crate::{auth, commands::settings::read_base_url};

/// Serializable error handed to the frontend (Laravel 422/401 bodies mapped).
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub status: Option<u16>,
    pub message: String,
    pub errors: Option<HashMap<String, Vec<String>>>,
}

impl ApiError {
    fn msg(message: &str) -> Self {
        Self { status: None, message: message.into(), errors: None }
    }
}

fn validate_request(method: &str, path: &str) -> Result<Method, ApiError> {
    let method = match method.to_ascii_uppercase().as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PUT" => Method::PUT,
        "PATCH" => Method::PATCH,
        "DELETE" => Method::DELETE,
        _ => return Err(ApiError::msg("Unsupported HTTP method")),
    };
    if !path.starts_with('/') || path.contains("://") || path.contains("..") {
        return Err(ApiError::msg("Invalid request path"));
    }
    Ok(method)
}

fn error_from_body(status: u16, body: &Value) -> ApiError {
    let message = body
        .get("message")
        .and_then(Value::as_str)
        .map(String::from)
        .unwrap_or_else(|| format!("Request failed ({status})"));
    let errors = body
        .get("errors")
        .and_then(|e| serde_json::from_value(e.clone()).ok());
    ApiError { status: Some(status), message, errors }
}

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder().timeout(Duration::from_secs(30)).build().expect("http client")
    })
}

/// Send one request. Non-2xx responses (including 401) come back as `ApiError`;
/// 401 side effects belong to the caller (`api_request`).
pub async fn send(
    app: &AppHandle,
    method: &str,
    path: &str,
    body: Option<Value>,
    with_token: bool,
) -> Result<Value, ApiError> {
    let method = validate_request(method, path)?;
    let base = read_base_url(app)
        .map_err(|e| ApiError::msg(&e))?
        .ok_or_else(|| ApiError::msg("Set the server URL in Settings"))?;

    let mut req = client()
        .request(method, format!("{base}{path}"))
        .header("Accept", "application/json");
    if with_token {
        if let Some(token) = auth::get_token().map_err(|e| ApiError::msg(&e))? {
            req = req.bearer_auth(token);
        }
    }
    if let Some(body) = body {
        req = req.json(&body);
    }

    let res = req.send().await.map_err(|_| ApiError::msg("Cannot reach server"))?;
    let status = res.status();
    let json: Value = res.json().await.unwrap_or(Value::Null);
    if status.is_success() { Ok(json) } else { Err(error_from_body(status.as_u16(), &json)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_method_and_path() {
        assert_eq!(validate_request("post", "/api/login").unwrap(), Method::POST);
        assert!(validate_request("TRACE", "/api/x").is_err());
        assert!(validate_request("GET", "api/x").is_err());
        assert!(validate_request("GET", "https://evil.test/x").is_err());
        assert!(validate_request("GET", "/api/../x").is_err());
    }

    #[test]
    fn maps_laravel_errors() {
        let e = error_from_body(
            422,
            &json!({"message": "The email field is required.", "errors": {"email": ["The email field is required."]}}),
        );
        assert_eq!(e.status, Some(422));
        assert_eq!(e.errors.unwrap()["email"][0], "The email field is required.");

        let e = error_from_body(401, &json!({"message": "Unauthenticated."}));
        assert_eq!((e.status, e.message.as_str()), (Some(401), "Unauthenticated."));
        assert!(e.errors.is_none());

        assert_eq!(error_from_body(500, &Value::Null).message, "Request failed (500)");
    }
}
