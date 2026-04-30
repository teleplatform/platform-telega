import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";

interface SendDocumentOptions {
  chatId: string | number;
  filePath: string;
  caption?: string;
  filename?: string;
  botToken?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
    document?: { file_name: string; file_size: number; mime_type: string };
  };
  error_code?: number;
  description?: string;
}

function buildFormBoundary(): string {
  return `----TelegramFormBoundary${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function buildMultipartBody(
  boundary: string,
  fields: Record<string, string>,
  fileFieldName: string,
  fileName: string,
  fileContent: Buffer,
): Buffer {
  const parts: Buffer[] = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
    parts.push(Buffer.from(`${value}\r\n`));
  }

  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n`));
  parts.push(Buffer.from(`Content-Type: text/markdown\r\n\r\n`));
  parts.push(fileContent);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return Buffer.concat(parts);
}

function postMultipart(
  url: string,
  body: Buffer,
  contentType: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "Content-Length": body.length.toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.setTimeout(60000, () => {
      req.destroy(new Error("Telegram sendDocument timeout"));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function sendDocument(options: SendDocumentOptions): Promise<TelegramApiResponse> {
  const botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  if (!fs.existsSync(options.filePath)) {
    throw new Error(`File not found: ${options.filePath}`);
  }

  const fileName = options.filename || path.basename(options.filePath);
  const fileContent = fs.readFileSync(options.filePath);
  const fileSize = fileContent.length;

  if (fileSize > 50 * 1024 * 1024) {
    throw new Error(`File too large: ${fileSize} bytes (max 50MB)`);
  }

  const fields: Record<string, string> = {
    chat_id: String(options.chatId),
  };

  if (options.caption) {
    fields.caption = options.caption.length > 1024 ? options.caption.slice(0, 1021) + "..." : options.caption;
    fields.parse_mode = "Markdown";
  }

  const boundary = buildFormBoundary();
  const body = buildMultipartBody(boundary, fields, "document", fileName, fileContent);

  const apiUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;

  try {
    const response = await postMultipart(apiUrl, body, `multipart/form-data; boundary=${boundary}`);

    if (response.statusCode !== 200) {
      return {
        ok: false,
        error_code: response.statusCode,
        description: `HTTP ${response.statusCode}: ${response.body.slice(0, 500)}`,
      };
    }

    const result = JSON.parse(response.body) as TelegramApiResponse;
    return result;
  } catch (e: any) {
    return {
      ok: false,
      error_code: 0,
      description: e?.message || "Unknown error sending document",
    };
  }
}

export async function sendTelegramMessage(params: {
  chatId: number | string;
  text: string;
  botToken?: string;
}): Promise<TelegramApiResponse> {
  return sendMessage(params.chatId, params.text, params.botToken);
}

export async function sendMessage(chatId: string | number, text: string, botToken?: string): Promise<TelegramApiResponse> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: String(chatId),
    text: text.length > 4096 ? text.slice(0, 4093) + "..." : text,
    parse_mode: "Markdown",
  });

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body).toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          try {
            resolve(JSON.parse(responseBody) as TelegramApiResponse);
          } catch {
            resolve({ ok: false, description: responseBody.slice(0, 500) });
          }
        });
      },
    );

    req.setTimeout(30000, () => {
      req.destroy(new Error("Telegram sendMessage timeout"));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export function buildLongformCaption(words: number, chars: number): string {
  return [
    "📄 Готовый материал",
    "",
    `📊 ${words} слов / ${chars} символов`,
    "Маршрут: Long Form Engine",
  ].join("\n");
}
