import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { isAuthenticated } from "@/services/api";
import LoginPage from "@/pages/login";
import SettingsPage from "@/pages/settings";
import DashboardPage from "@/pages/dashboard";
import NotesPage from "@/pages/notes";
import AppLayout from "@/components/AppLayout";

function AppRoutes() {
  const navigate = useNavigate();

  // Rust emits this when the API rejects the token (401).
  useEffect(() => {
    const unlisten = listen("auth-expired", () => navigate("/login"));
    return () => {
      unlisten.then((f) => f());
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/notes" element={<NotesPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [start, setStart] = useState<string | null>(null);

  useEffect(() => {
    isAuthenticated()
      .then((ok) => setStart(ok ? "/dashboard" : "/login"))
      .catch(() => setStart("/login"));
  }, []);

  if (!start) return null;
  return (
    <MemoryRouter initialEntries={[start]}>
      <AppRoutes />
    </MemoryRouter>
  );
}
