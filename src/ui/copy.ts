import { toast } from "./toastStore";

export async function copyToClipboard(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

export async function copyWithToast(text: string) {
  try {
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.show({
        kind: "success",
        message: "Скопировано в буфер обмена",
        iconSrc: "/brand/telegpt-logo.png",
        durationMs: 1600,
      });
      return true;
    }
  } catch {
    // ignore
  }

  toast.show({ kind: "error", message: "Не удалось скопировать" });
  return false;
}
