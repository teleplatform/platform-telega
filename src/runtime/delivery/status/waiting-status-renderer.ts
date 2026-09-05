import type { StatusKind, StatusProgress } from "./waiting-status.types.js";
import { TELEGPT_DISPLAY } from "../../public-surface/public-surface.types.js";

const T = TELEGPT_DISPLAY;

function emoji(kind: StatusKind): string {
  switch (kind) {
    case "streaming_text": return "✍️";
    case "image_generation": return "🖼";
    case "relay": return "📦";
    case "bridge": return "🔄";
    case "completed": return "✅";
    case "failed": return "⚠️";
  }
}

function emojiPublic(kind: StatusKind): string {
  switch (kind) {
    case "streaming_text": return "✍️";
    case "image_generation": return "🎨";
    case "relay": return "⏳";
    case "bridge": return "⏳";
    case "completed": return "✅";
    case "failed": return "⚠️";
  }
}

export function renderStatusText(progress: StatusProgress, isPublic?: boolean): string {
  const { kind } = progress;

  if (isPublic) {
    return renderPublic(progress);
  }

  if (kind === "completed") {
    return `${emoji(kind)} Got it.`;
  }

  if (kind === "failed") {
    const fallback = progress.message ?? "Не получилось завершить ответ. Сохранил всё, что удалось получить.";
    return `${emoji(kind)} ${fallback}`;
  }

  if (kind === "streaming_text") {
    const elapsed = progress.elapsedMs ?? 0;
    const sec = Math.floor(elapsed / 1000);
    if (progress.charCount != null && progress.charCount > 0) {
      const label = progress.charCount >= 1000
        ? `${(progress.charCount / 1000).toFixed(1)}K`
        : `${progress.charCount}`;
      return `${emoji(kind)} Уже получил ${label} символов… (${sec}s)`;
    }
    return `${emoji(kind)} Получаю ответ… (${sec}s)`;
  }

  if (kind === "image_generation") {
    const prompt = progress.prompt ? ` «${progress.prompt.slice(0, 40)}»` : "";
    return `${emoji(kind)} Картинка рендерится${prompt}…`;
  }

  if (kind === "relay") {
    const part = progress.part ?? 1;
    const total = progress.totalParts ?? 1;
    return `${emoji(kind)} Отправляю часть ${part}/${total}…`;
  }

  if (kind === "bridge") {
    const elapsed = progress.elapsedMs ?? 0;
    const sec = Math.floor(elapsed / 1000);
    return `${emoji(kind)} Выполняю… (${sec}s)`;
  }

  return `${emoji(kind)} Working…`;
}

function renderPublic(progress: StatusProgress): string {
  const { kind } = progress;

  if (kind === "completed") {
    return `✅ ${T} завершил ответ.`;
  }

  if (kind === "failed") {
    return `⚠️ ${T} временно не смог завершить ответ. Попробуй ещё раз через пару секунд.`;
  }

  if (kind === "streaming_text") {
    const elapsed = progress.elapsedMs ?? 0;
    const sec = Math.floor(elapsed / 1000);
    if (progress.charCount != null && progress.charCount > 0) {
      const label = progress.charCount >= 1000
        ? `${(progress.charCount / 1000).toFixed(1)}K`
        : `${progress.charCount}`;
      return `✍️ ${T} пишет ответ… (${label}, ${sec}s)`;
    }
    return `✍️ ${T} пишет ответ… (${sec}s)`;
  }

  if (kind === "image_generation") {
    const prompt = progress.prompt ? ` «${progress.prompt.slice(0, 40)}»` : "";
    return `🎨 ${T} создаёт изображение${prompt}…`;
  }

  if (kind === "relay") {
    return `⏳ ${T} готовит ответ…`;
  }

  if (kind === "bridge") {
    return `⏳ ${T} готовит ответ…`;
  }

  return `⏳ ${T} думает…`;
}
