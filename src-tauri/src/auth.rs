//! OS keychain access for the Sanctum token. The token never leaves Rust.
use keyring::{Entry, Error};

const SERVICE: &str = "com.amitavroy.hive";
const USER: &str = "access_token";

/// Read the stored token, if any.
pub fn get_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, USER).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete the stored token. A missing token is not an error.
pub fn delete_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE, USER).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
