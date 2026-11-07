import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Loader2, Lock, Mail, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBaseUrl, login, type ApiError } from "@/services/api";
import { HiveLogo } from "./HiveLogo";
import { Honeycomb } from "./Honeycomb";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noUrl, setNoUrl] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNoUrl(false);
    setLoading(true);
    try {
      if (!(await getBaseUrl())) {
        setNoUrl(true);
        return;
      }
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      const e = err as Partial<ApiError>;
      setError(e.errors?.email?.[0] ?? e.message ?? "Login failed. Try again.");
    } finally {
      // Credentials must never be kept.
      setPassword("");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-8">
      <Honeycomb />
      <Link
        to="/settings"
        aria-label="Settings"
        className="absolute right-6 top-6 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings className="size-5" />
      </Link>
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-[440px] rounded-2xl border border-border bg-card/85 px-10 pb-10 pt-9 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,196,0,0.45)] backdrop-blur-sm"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              "radial-gradient(120% 60% at 0% 0%, rgba(255,196,0,0.08), transparent 55%), radial-gradient(100% 60% at 100% 100%, rgba(255,196,0,0.07), transparent 55%)",
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center">
          <HiveLogo className="h-24 w-24" />
          <h1 className="mt-3 text-[28px] font-semibold uppercase tracking-[0.45em] text-foreground">
            <span className="pl-[0.45em]">Hive</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Your developer assistant</p>

          <div className="mt-8 w-full space-y-3">
            <div className="relative">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="Email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 pl-11"
              />
            </div>
            <div className="relative">
              <Label htmlFor="password" className="sr-only">Password</Label>
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {noUrl && (
            <p role="alert" className="mt-3 w-full text-sm text-destructive">
              Set the server URL in{" "}
              <Link to="/settings" className="underline">Settings</Link> first.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 w-full text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-12 w-full text-[15px] hover:shadow-[0_0_24px_rgba(255,196,0,0.25)]"
          >
            {loading && <Loader2 className="animate-spin" />}
            Log In
          </Button>
        </div>
      </form>
    </main>
  );
}
