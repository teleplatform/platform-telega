export class WebExtractionEngine {
  extractCodeBlocks(text: string): Array<{ language: string; content: string }> {
    const blocks: Array<{ language: string; content: string }> = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      blocks.push({ language: match[1] || "text", content: match[2].trim() });
    }
    return blocks;
  }

  stripCodeBlocks(text: string): string {
    return text.replace(/```[\s\S]*?```/g, "").trim();
  }

  detectLoginWall(visibleText: string): boolean {
    const signals = ["log in", "sign in", "sign up", "log in to continue", "please log in", "sign in to chat"];
    const lower = visibleText.toLowerCase();
    return signals.some((s) => lower.includes(s));
  }

  detectCaptcha(visibleText: string): boolean {
    const signals = ["verify you are human", "captcha", "i'm not a robot", "security check", "please verify"];
    const lower = visibleText.toLowerCase();
    return signals.some((s) => lower.includes(s));
  }

  detectRateLimit(visibleText: string): boolean {
    const signals = ["rate limit", "too many requests", "try again later", "you have been rate limited", "slow down"];
    const lower = visibleText.toLowerCase();
    return signals.some((s) => lower.includes(s));
  }
}
