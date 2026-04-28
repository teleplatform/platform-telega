import { withSessionPage } from "../browserd";
import { open, mustWait, typeInto, click, readText } from "../dsl";
import type { WebProviderAdapter } from "../types";

export const DeepSeekAdapter: WebProviderAdapter = {
  id: "deepseek_web",
  baseUrl: "https://chat.deepseek.com/",
  selectors: {
    input: "textarea", // TODO: real selector
    send: "button[type='submit']", // TODO: real selector
    lastAnswer: "main *:last-child", // TODO: real selector
    loginHint: "form[action*='login'], input[type='password']", // TODO
  },

  async selfTest() {
    try {
      await withSessionPage(this.id, async (page) => {
        await open(page, this.baseUrl);
        const login = this.selectors.loginHint ? await page.$(this.selectors.loginHint) : null;
        if (login) throw new Error("login_required");
        await mustWait(page, this.selectors.input);
        await mustWait(page, this.selectors.send);
      });
      return { ok: true, details: { provider: this.id } };
    } catch (e: any) {
      return {
        ok: false,
        reason: String(e?.message || e) === "login_required" ? "login_required" : "health_failed",
        details: { err: String(e?.message || e) },
      };
    }
  },

  async runChat(prompt: string) {
    try {
      return await withSessionPage(this.id, async (page) => {
        await open(page, this.baseUrl);
        const login = this.selectors.loginHint ? await page.$(this.selectors.loginHint) : null;
        if (login) return { ok: false as const, error: "login_required" };
        await mustWait(page, this.selectors.input);
        await typeInto(page, this.selectors.input, prompt);
        await click(page, this.selectors.send);
        await mustWait(page, this.selectors.lastAnswer, 60_000);
        const answer = await readText(page, this.selectors.lastAnswer);
        return { ok: true, answer };
      });
    } catch (e: any) {
      return { ok: false, error: "run_failed", meta: { err: String(e?.message || e) } };
    }
  },
};
