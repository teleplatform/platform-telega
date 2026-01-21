import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type TranslateRequest = {
  text: string;
};

function cleanOutput(s: string) {
  // убираем лишние пробелы по краям
  return s.replace(/\r/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TranslateRequest;

    const text = (body?.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: "EMPTY_TEXT" }, { status: 400 });
    }

    // ВАЖНО: вызываем ollama локально
    // translategemma:en — твой строгий переводчик
    const { stdout } = await execFileAsync("ollama", ["run", "translategemma:en", text], {
      timeout: 15000,
      maxBuffer: 1024 * 1024 * 4,
    });

    const translated = cleanOutput(stdout);

    return NextResponse.json({
      ok: true,
      translatedText: translated,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "TRANSLATE_FAILED" },
      { status: 500 }
    );
  }
}
