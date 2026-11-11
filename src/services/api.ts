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

export type Reminder = {
  id: number;
  title: string;
  notes: string | null;
  type: "once" | "recurring";
  remind_at: string | null;
  interval_minutes: number | null;
  is_active: boolean;
  created_at: string;
};

/** Writable fields; send `null` for the field that doesn't match `type`. */
export type ReminderInput = Partial<Omit<Reminder, "id" | "created_at">>;

type Page<T> = { data: T[]; meta?: { last_page?: number } };

/** Every reminder (active or not), walking all pages. */
export async function listReminders() {
  const all: Reminder[] = [];
  for (let page = 1; ; page++) {
    const res = await request<Page<Reminder>>("GET", `/api/reminders?page=${page}`);
    all.push(...res.data);
    if (page >= (res.meta?.last_page ?? 1)) return all;
  }
}

export const createReminder = (r: ReminderInput) => request("POST", "/api/reminders", r);

export const updateReminder = (id: number, r: ReminderInput) =>
  request("PUT", `/api/reminders/${id}`, r);

export const deleteReminder = (id: number) => request("DELETE", `/api/reminders/${id}`);

/** Re-pull active reminders into the Rust cache the scheduler reads. */
export const refreshReminders = () => invoke<void>("refresh_reminders");

/** id -> ISO time the local scheduler last fired it. */
export const reminderLastFired = () => invoke<Record<number, string>>("reminder_last_fired");
