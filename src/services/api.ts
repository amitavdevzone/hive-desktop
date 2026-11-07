import { invoke } from "@tauri-apps/api/core";

/** Error shape returned by the Rust commands (Laravel 422/401 mapped). */
export type ApiError = {
  status: number | null;
  message: string;
  errors: Record<string, string[]> | null;
};

export function request<T = unknown>(method: string, path: string, body?: unknown) {
  return invoke<T>("api_request", { method, path, body });
}

export const login = (email: string, password: string) =>
  invoke<void>("login", { email, password });

export const isAuthenticated = () => invoke<boolean>("is_authenticated");

export const getBaseUrl = () => invoke<string | null>("get_base_url");

export const setBaseUrl = (url: string) => invoke<void>("set_base_url", { url });
