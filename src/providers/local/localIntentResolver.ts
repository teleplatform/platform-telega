export type LocalIntent =
  | "code" | "translation" | "summary" | "vision" | "reasoning" | "chat";

export function resolveLocalIntent(prompt: string): LocalIntent {
  const text = prompt.toLowerCase();

  if (/подумай|проанализируй|объясни|reasoning|сложн[аоы]|анализ|eval|оцен[ик]/.test(text)) {
    return "reasoning";
  }

  if (/код|typescript|python|java|rust|go\b|функци[яю]|ошибк[аи]|архитектур[аы]|api|schema|компонент/.test(text)) {
    return "code";
  }

  if (/переведи|translate|translation|на английский|на русский|перевод/.test(text)) {
    return "translation";
  }

  if (/суммируй|выжимк[ау]|summary|кратк[оа]|резюмир/.test(text)) {
    return "summary";
  }

  if (/фото|картинк[ау]|изображени[ея]|image|vision|что на изображении|опиши фото/.test(text)) {
    return "vision";
  }

  return "chat";
}
