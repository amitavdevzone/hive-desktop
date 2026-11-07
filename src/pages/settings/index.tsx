import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBaseUrl, setBaseUrl } from "@/services/api";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBaseUrl().then((u) => u && setUrl(u));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await setBaseUrl(url);
      setSaved(true);
    } catch (err) {
      setError(typeof err === "string" ? err : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-8">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[440px] space-y-4 rounded-2xl border border-border bg-card px-10 py-9"
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <div className="space-y-2">
          <Label htmlFor="base-url">Server URL</Label>
          <Input
            id="base-url"
            type="url"
            placeholder="https://hive-be.test"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-12"
          />
          <p className="text-xs text-muted-foreground">
            Saving a different URL signs you out.
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saved && <p role="status" className="text-sm text-primary">Saved.</p>}
        <Button type="submit" disabled={saving} className="h-12 w-full text-[15px]">
          {saving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </form>
    </main>
  );
}
