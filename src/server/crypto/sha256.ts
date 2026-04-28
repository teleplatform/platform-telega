import crypto from "crypto";

export async function sha256HexFromFile(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  return crypto.createHash("sha256").update(buf).digest("hex");
}
