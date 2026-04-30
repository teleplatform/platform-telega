
# Telegram HTML Builder v1

## Status
🟢 **APPROVED** — Canonical Candidate → Pilot / Integration Ready

## Position in Architecture

```
Tele•Ga Core
└─ Communication Layer
   └─ Telegram
      └─ HTML Builder v1
```

## Purpose
Унифицированный, объяснимый кирпич для генерации Telegram HTML-разметки с поддержкой:
- Стандартного форматирования (bold, italic, code, etc.)
- Premium Emoji с автоматическим fallback
- Public / Maker split (базовый UX без Premium)
- Канонических правил для parse_mode

## ARCHITECTURE

### Core Principles
1. **Fallback-first** — базовый UX всегда работает без Premium
2. **Type-safe** — TypeScript-интерфейсы для всех компонентов
3. **Composable** — мелкие, переиспользуемые компоненты
4. **Explainable** — trace hooks для отладки и анализа

### Components

#### 1. Base HTML Builder
```typescript
interface HtmlBuilder {
  // Text formatting
  bold(text: string): string;
  italic(text: string): string;
  underline(text: string): string;
  strikethrough(text: string): string;
  spoiler(text: string): string;

  // Code formatting
  code(text: string): string;
  pre(text: string, language?: string): string;

  // Links
  link(url: string, text: string): string;
  userLink(userId: number, text: string): string;

  // Lists
  unorderedList(items: string[]): string;
  orderedList(items: string[]): string;

  // Blockquote
  blockquote(text: string): string;

  // Custom HTML
  custom(html: string): string;
}
```

#### 2. Premium Emoji Builder
```typescript
interface PremiumEmojiBuilder {
  // Build premium emoji with fallback
  premiumEmoji(
    emoji: string,
    emojiId: string,
    text?: string
  ): string;

  // Build premium emoji in blockquote
  premiumBlockquote(
    emoji: string,
    emojiId: string,
    text: string
  ): string;

  // Auto-detect user premium status
  isUserPremium(userId: number): Promise<boolean>;

  // Build with auto-fallback based on user premium status
  buildWithFallback(
    userId: number,
    content: (isPremium: boolean) => string
  ): Promise<string>;
}
```

#### 3. Message Builder
```typescript
interface MessageBuilder {
  // Build complete message
  buildMessage(options: MessageOptions): Message;

  // Build message with auto-fallback
  buildMessageWithFallback(
    userId: number,
    options: MessageOptions
  ): Promise<Message>;
}

interface MessageOptions {
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyToMessageId?: number;
  replyMarkup?: any;
}

interface Message {
  text: string;
  parseMode: string;
  options: MessageOptions;
}
```

#### 4. UI Helpers
```typescript
interface UiHelpers {
  // Product title with premium emoji
  productTitle(
    productName: string,
    isPremium?: boolean
  ): string;

  // Action buttons text
  actionButton(
    emoji: string,
    emojiId?: string,
    text: string,
    isPremium?: boolean
  ): string;

  // Status message
  statusMessage(
    status: "success" | "error" | "warning" | "info",
    message: string,
    isPremium?: boolean
  ): string;

  // Navigation hint
  navHint(
    direction: "next" | "prev" | "up" | "down",
    text: string,
    isPremium?: boolean
  ): string;
}
```

## API CONTRACT

### 1. Base HTML Builder API

```typescript
class TelegramHtmlBuilder implements HtmlBuilder {
  // Text formatting
  bold(text: string): string {
    return `<b>${this.escapeHtml(text)}</b>`;
  }

  italic(text: string): string {
    return `<i>${this.escapeHtml(text)}</i>`;
  }

  underline(text: string): string {
    return `<u>${this.escapeHtml(text)}</u>`;
  }

  strikethrough(text: string): string {
    return `<s>${this.escapeHtml(text)}</s>`;
  }

  spoiler(text: string): string {
    return `<tg-spoiler>${this.escapeHtml(text)}</tg-spoiler>`;
  }

  // Code formatting
  code(text: string): string {
    return `<code>${this.escapeHtml(text)}</code>`;
  }

  pre(text: string, language?: string): string {
    if (language) {
      return `<pre><code class="language-${language}">${this.escapeHtml(text)}</code></pre>`;
    }
    return `<pre>${this.escapeHtml(text)}</pre>`;
  }

  // Links
  link(url: string, text: string): string {
    return `<a href="${this.escapeHtml(url)}">${this.escapeHtml(text)}</a>`;
  }

  userLink(userId: number, text: string): string {
    return `<a href="tg://user?id=${userId}">${this.escapeHtml(text)}</a>`;
  }

  // Lists
  unorderedList(items: string[]): string {
    return items.map(item => `• ${item}`).join("\n");
  }

  orderedList(items: string[]): string {
    return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }

  // Blockquote
  blockquote(text: string): string {
    return `<blockquote>${this.escapeHtml(text)}</blockquote>`;
  }

  // Custom HTML
  custom(html: string): string {
    return html;
  }

  // Helper: escape HTML
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
```

### 2. Premium Emoji Builder API

```typescript
class PremiumEmojiBuilderImpl implements PremiumEmojiBuilder {
  constructor(
    private htmlBuilder: HtmlBuilder,
    private premiumDetector: PremiumDetector
  ) {}

  premiumEmoji(emoji: string, emojiId: string, text?: string): string {
    const content = text ? `${emoji} ${text}` : emoji;
    return `<tg-emoji emoji-id="${emojiId}">${emoji}</tg-emoji>${text ? ` ${text}` : ""}`;
  }

  premiumBlockquote(emoji: string, emojiId: string, text: string): string {
    return `<blockquote><tg-emoji emoji-id="${emojiId}">${emoji}</tg-emoji> ${this.htmlBuilder.bold(text)}</blockquote>`;
  }

  async isUserPremium(userId: number): Promise<boolean> {
    return await this.premiumDetector.isPremium(userId);
  }

  async buildWithFallback(
    userId: number,
    content: (isPremium: boolean) => string
  ): Promise<string> {
    const isPremium = await this.isUserPremium(userId);
    return content(isPremium);
  }
}

interface PremiumDetector {
  isPremium(userId: number): Promise<boolean>;
}
```

### 3. Message Builder API

```typescript
class TelegramMessageBuilder implements MessageBuilder {
  constructor(
    private htmlBuilder: HtmlBuilder,
    private premiumEmojiBuilder: PremiumEmojiBuilder
  ) {}

  buildMessage(options: MessageOptions): Message {
    return {
      text: options.text,
      parseMode: options.parseMode || "HTML",
      options: {
        ...options,
        parseMode: options.parseMode || "HTML"
      }
    };
  }

  async buildMessageWithFallback(
    userId: number,
    options: MessageOptions
  ): Promise<Message> {
    const isPremium = await this.premiumEmojiBuilder.isUserPremium(userId);
    // Apply premium-specific transformations if needed
    const text = this.applyPremiumFallback(options.text, isPremium);

    return {
      text,
      parseMode: options.parseMode || "HTML",
      options: {
        ...options,
        parseMode: options.parseMode || "HTML"
      }
    };
  }

  private applyPremiumFallback(text: string, isPremium: boolean): string {
    if (!isPremium) {
      // Replace premium emoji tags with standard emoji
      return text.replace(
        /<tg-emoji emoji-id="[^"]+">([^<]+)<\/tg-emoji>/g,
        "$1"
      );
    }
    return text;
  }
}
```

### 4. UI Helpers API

```typescript
class TelegramUiHelpers implements UiHelpers {
  constructor(
    private htmlBuilder: HtmlBuilder,
    private premiumEmojiBuilder: PremiumEmojiBuilder
  ) {}

  productTitle(productName: string, isPremium = false): string {
    const emoji = "👇";
    const emojiId = "5470177992950946662"; // Example emoji ID

    if (isPremium) {
      return this.premiumEmojiBuilder.premiumBlockquote(emoji, emojiId, productName);
    }

    return this.htmlBuilder.blockquote(`${emoji} ${this.htmlBuilder.bold(productName)}`);
  }

  actionButton(
    emoji: string,
    emojiId: string | undefined,
    text: string,
    isPremium = false
  ): string {
    if (isPremium && emojiId) {
      return this.premiumEmojiBuilder.premiumEmoji(emoji, emojiId, text);
    }

    return `${emoji} ${this.htmlBuilder.bold(text)}`;
  }

  statusMessage(
    status: "success" | "error" | "warning" | "info",
    message: string,
    isPremium = false
  ): string {
    const emojis = {
      success: { emoji: "✅", emojiId: "5470177992950946663" },
      error: { emoji: "❌", emojiId: "5470177992950946664" },
      warning: { emoji: "⚠️", emojiId: "5470177992950946665" },
      info: { emoji: "ℹ️", emojiId: "5470177992950946666" }
    };

    const { emoji, emojiId } = emojis[status];

    if (isPremium) {
      return this.premiumEmojiBuilder.premiumEmoji(emoji, emojiId, message);
    }

    return `${emoji} ${message}`;
  }

  navHint(
    direction: "next" | "prev" | "up" | "down",
    text: string,
    isPremium = false
  ): string {
    const emojis = {
      next: { emoji: "➡️", emojiId: "5470177992950946667" },
      prev: { emoji: "⬅️", emojiId: "5470177992950946668" },
      up: { emoji: "⬆️", emojiId: "5470177992950946669" },
      down: { emoji: "⬇️", emojiId: "5470177992950946670" }
    };

    const { emoji, emojiId } = emojis[direction];

    if (isPremium) {
      return this.premiumEmojiBuilder.premiumEmoji(emoji, emojiId, text);
    }

    return `${emoji} ${text}`;
  }
}
```

## TRACE HOOKS

### HTML Generation Hooks
```typescript
interface HtmlGenerationEvent {
  eventType: "html_generated" | "premium_fallback" | "html_error";
  userId: number;
  timestamp: string;
  content: {
    html: string;
    isPremium: boolean;
    hasPremiumEmoji: boolean;
  };
  error?: string;
}
```

### Premium Detection Hooks
```typescript
interface PremiumDetectionEvent {
  eventType: "premium_detected" | "premium_not_detected" | "detection_error";
  userId: number;
  timestamp: string;
  isPremium: boolean;
  error?: string;
}
```

### Trace Hook Integration
```typescript
interface TraceConfig {
  enabled: boolean;
  endpoints: {
    explain: string;
    missionControl: string;
    knowledgePacks: string;
  };
  filters: {
    eventTypes: string[];
    userIds?: number[];
  };
}
```

## PILOT SCENARIO

### Objective
Валидировать Telegram HTML Builder v1 с реальными сценариями использования в Tele•Ga / MarketBase.

### Test Scenarios
1. **Product selection** — productTitle с Premium Emoji и fallback
2. **Action buttons** — actionButton с Premium Emoji и fallback
3. **Status messages** — statusMessage с разными типами статусов
4. **Navigation hints** — navHint для навигации по спискам

### Success Criteria
- ✅ Все UI helpers работают корректно с Premium и без
- ✅ Fallback работает автоматически для non-Premium пользователей
- ✅ Trace hooks корректно отправляют события
- ✅ HTML-разметка валидна для Telegram Bot API
- ✅ Нет утечек HTML/JS (XSS protection)

### Pilot Deliverables
- Test results report
- Trace events analysis
- Performance metrics
- Recommendations for v2 improvements

## Integration Points

### Consumers
1. **MarketBase** — product titles, action buttons, status messages
2. **B2B Market Link** — navigation hints, status messages
3. **Tele•Ga Core** — все Telegram-сообщения

### Dependencies
- Telegram Bot API
- Forge Explain (trace hooks)
- Mission Control (monitoring)
- Knowledge Packs (learning)

## Usage Examples

### Example 1: Product Title with Auto-Fallback
```typescript
const htmlBuilder = new TelegramHtmlBuilder();
const premiumDetector = new TelegramPremiumDetector();
const premiumEmojiBuilder = new PremiumEmojiBuilderImpl(htmlBuilder, premiumDetector);
const uiHelpers = new TelegramUiHelpers(htmlBuilder, premiumEmojiBuilder);

// Auto-detect user premium status
const userId = ctx.from.id;
const isPremium = await premiumEmojiBuilder.isUserPremium(userId);

// Build product title with auto-fallback
const productTitle = uiHelpers.productTitle("Выберите товар:", isPremium);

// Send message
await ctx.reply(productTitle, { parse_mode: "HTML" });
```

### Example 2: Status Message with Premium Emoji
```typescript
const statusMessage = uiHelpers.statusMessage("success", "Заказ создан", isPremium);

await ctx.reply(statusMessage, { parse_mode: "HTML" });
```

### Example 3: Navigation Hint with Premium Emoji
```typescript
const navHint = uiHelpers.navHint("next", "Следующая страница", isPremium);

await ctx.reply(navHint, { parse_mode: "HTML" });
```

### Example 4: Custom HTML with Premium Emoji
```typescript
const customMessage = await premiumEmojiBuilder.buildWithFallback(
  userId,
  (isPremium) => {
    if (isPremium) {
      return `<blockquote><tg-emoji emoji-id="5470177992950946662">👇</tg-emoji> ${htmlBuilder.bold("Выберите действие:")}</blockquote>`;
    }
    return `<blockquote>👇 ${htmlBuilder.bold("Выберите действие:")}</blockquote>`;
  }
);

await ctx.reply(customMessage, { parse_mode: "HTML" });
```

## License
Apache 2.0 — compatible with Tele•Ga commercial core

## Version History
- v1.0 — Initial canonical specification (2026-02-03)
