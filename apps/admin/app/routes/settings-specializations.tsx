import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";

import {
  fetchAdminSpecializationsSettings,
  updateAdminSpecializationsSettings,
} from "../lib/adminApi";
import type { AdminRouteContext } from "./admin";

const MIN_COOLDOWN_MONTHS = 1;
const MAX_COOLDOWN_MONTHS = 120;

export default function SpecializationsSettingsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canManage = admin.permissions.includes("create_community");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [defaultCooldownInput, setDefaultCooldownInput] = useState("");

  useEffect(() => {
    if (!canManage) return;
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetchAdminSpecializationsSettings();
        setDefaultCooldownInput(String(res.default_join_cooldown_months));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load specialization settings."
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [canManage]);

  const handleSave = async () => {
    if (!canManage) return;
    setSuccess(null);
    setError(null);

    const raw = defaultCooldownInput.trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError("Default cooldown must be a whole number of months.");
      return;
    }
    if (parsed < MIN_COOLDOWN_MONTHS || parsed > MAX_COOLDOWN_MONTHS) {
      setError(`Default cooldown must be between ${MIN_COOLDOWN_MONTHS} and ${MAX_COOLDOWN_MONTHS}.`);
      return;
    }

    if (!window.confirm(`Update default cooldown to ${parsed} months?`)) return;

    setIsSaving(true);
    try {
      const res = await updateAdminSpecializationsSettings({
        defaultJoinCooldownMonths: parsed,
      });
      setDefaultCooldownInput(String(res.default_join_cooldown_months));
      setSuccess("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update specialization settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase text-text-light">Settings</p>
        <h1 className="text-2xl font-semibold text-strong">Specializations</h1>
        <p className="text-sm text-text-secondary">
          Default cooldown applies to future unjoins only; active cooldowns are locked in at the
          time the user unjoined.
        </p>
      </header>

      {!canManage && (
        <div className="rounded-2xl border border-border bg-bg px-5 py-5 text-sm text-text-secondary">
          You do not have permission to manage specialization settings.
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-border bg-bg px-5 py-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase text-text-light"
                htmlFor="default-join-cooldown-months"
              >
                Default join cooldown (months)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="default-join-cooldown-months"
                  type="number"
                  min={MIN_COOLDOWN_MONTHS}
                  max={MAX_COOLDOWN_MONTHS}
                  value={defaultCooldownInput}
                  onChange={(event) => setDefaultCooldownInput(event.target.value)}
                  disabled={isLoading || isSaving}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-xs"
                  placeholder="6"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || isSaving}
                  className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
              <p className="text-xs text-text-light">
                When a user hits the cooldown, the app blocks joining and shows “resets on &lt;date&gt;”.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

