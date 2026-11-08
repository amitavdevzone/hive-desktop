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

export type Note = {
  id: number;
  remote_id: number | null;
  title: string;
  text: string;
  format: "plain" | "markdown";
  tags: string[];
  status: "synced" | "dirty" | "deleted";
  last_error: string | null;
  updated_at: string;
};

export const listNotes = () => invoke<Note[]>("list_notes");

export const getNote = (id: number) => invoke<Note | null>("get_note", { id });

export const syncNow = () => invoke<void>("sync_now");

export const createNote = () => invoke<Note>("create_note");

export const saveNote = (n: Pick<Note, "id" | "title" | "text" | "format" | "tags">) =>
  invoke<Note>("save_note", { ...n });

export const deleteNote = (id: number) => invoke<void>("delete_note", { id });

export const listTagNames = () => invoke<string[]>("list_tag_names");

export const getAutoSync = () => invoke<boolean>("get_auto_sync");

export const setAutoSync = (enabled: boolean) => invoke<void>("set_auto_sync", { enabled });
