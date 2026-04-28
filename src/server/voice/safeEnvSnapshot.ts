import { existsSync } from "fs";

export function safeEnvSnapshot() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const tgSay = process.env.TELEGPT_TG_SAY || `${home}/bin/tg-say`;

  return {
    node_env: process.env.NODE_ENV || "unknown",
    platform: process.platform,
    telegpt_say_enabled: process.env.TELEGPT_SAY_ENABLED === "1",
    tg_say_path_present: existsSync(tgSay),
  };
}
