import { DEFAULT_FILE_CONFIG, type FileIngestResult } from "./chat-surface.types.js";

export async function canUseFileReading(userId: string | number | null): Promise<boolean> {
  const { getRuntimeRole, hasCapability } = await import("../../core/auth/runtime-access.js");
  const role = getRuntimeRole(userId);
  return hasCapability(userId, "file_reading") || role.startsWith("owner_") || role === "partner_creator";
}

export async function canUseFileUpload(userId: string | number | null): Promise<boolean> {
  const { getRuntimeRole, hasCapability } = await import("../../core/auth/runtime-access.js");
  const role = getRuntimeRole(userId);
  return hasCapability(userId, "file_upload") || role.startsWith("owner_") || role === "partner_creator" || role === "public";
}

export async function ingestFile(
  userId: string | number,
  fileId: string,
  fileName: string,
  mimeType: string
): Promise<FileIngestResult> {
  if (!await canUseFileReading(userId)) {
    return {
      fileId,
      fileName,
      mimeType,
      content: "",
      normalized: false,
    };
  }

  const config = DEFAULT_FILE_CONFIG;
  
  if (!config.supportedMimeTypes.includes(mimeType)) {
    return {
      fileId,
      fileName,
      mimeType,
      content: "",
      normalized: false,
    };
  }

  try {
    console.log(`[file-ingest] processing file from user=${userId}, file=${fileName}, type=${mimeType}`);
    
    return {
      fileId,
      fileName,
      mimeType,
      content: `[file content placeholder for ${fileName}]`,
      normalized: true,
      tokens: 100,
    };
  } catch (e: any) {
    return {
      fileId,
      fileName,
      mimeType,
      content: "",
      normalized: false,
    };
  }
}

export function extractTextFromMime(mimeType: string): string {
  const types: Record<string, string> = {
    "text/plain": "text",
    "text/markdown": "markdown", 
    "text/csv": "csv",
    "application/json": "json",
    "application/javascript": "code",
    "text/typescript": "code",
    "application/pdf": "pdf",
  };
  
  return types[mimeType] || "binary";
}