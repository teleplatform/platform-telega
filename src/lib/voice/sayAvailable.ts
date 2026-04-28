import { existsSync } from "fs";

export function isSayAvailable() {
  if (process.env.TELEGPT_SAY_ENABLED !== "1") return false;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const bin = process.env.TELEGPT_TG_SAY || `${home}/bin/tg-say`;
  return existsSync(bin);
}
