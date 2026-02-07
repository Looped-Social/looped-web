import { useToast } from "./ToastProvider";

export function ToastUsageExample() {
  const { showToast, hideToast } = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
        onClick={() =>
          showToast({
            kind: "success",
            text: "First and last name auto-filled.",
          })
        }
      >
        Show success toast
      </button>

      <button
        type="button"
        className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary"
        onClick={() =>
          showToast({
            kind: "loading",
            text: "Uploading your profile image...",
          })
        }
      >
        Show loading toast
      </button>

      <button
        type="button"
        className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary"
        onClick={hideToast}
      >
        Hide toast
      </button>
    </div>
  );
}

