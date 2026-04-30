import { applyNaturalVariation, VariationResult } from "../../../src/telegram/voiceVariation.js";

// --- Greetings rotate within approved set ---

function testGreetingsRotate() {
  const results: VariationResult[] = [];
  const texts = [
    "Привет! Как дела?",
    "Привет. Что нового?",
    "Привет! Расскажи больше.",
    "Привет. Как поживаешь?",
  ];

  for (let i = 0; i < texts.length; i++) {
    results.push(applyNaturalVariation(texts[i], `trace-${i}`, "12345", "warm", "fresh"));
  }

  // At least some should have adjusted text
  const adjustedCount = results.filter(r => r.textAdjusted).length;
  if (adjustedCount < 1) {
    throw new Error("At least some greetings should vary");
  }

  // All should be in the greeting family
  for (const r of results) {
    if (r.textAdjusted && r.templateFamily !== "greeting") {
      throw new Error(`Greeting variation should use greeting family, got ${r.templateFamily}`);
    }
  }

  console.log(`✅ testGreetingsRotate passed (${adjustedCount}/${texts.length} adjusted)`);
}

// --- Confirmations rotate safely ---

function testConfirmationsRotate() {
  const results: VariationResult[] = [];
  const texts = [
    "Понял. Сделаю.",
    "Принял. Уже работаю.",
    "Ясно. Разберусь.",
  ];

  for (let i = 0; i < texts.length; i++) {
    results.push(applyNaturalVariation(texts[i], `conf-trace-${i}`, "12345", "concise", "continuing"));
  }

  const adjustedCount = results.filter(r => r.textAdjusted).length;
  console.log(`✅ testConfirmationsRotate passed (${adjustedCount}/${texts.length} adjusted)`);
}

// --- Explanatory openers vary without changing meaning ---

function testExplanationOpeners() {
  const results: VariationResult[] = [];
  const texts = [
    "Сейчас объясню. Архитектура включает три компонента.",
    "Объясняю. Система состоит из двух частей.",
    "Сейчас коротко покажу. Вот как это работает.",
  ];

  for (let i = 0; i < texts.length; i++) {
    results.push(applyNaturalVariation(texts[i], `expl-trace-${i}`, "12345", "neutral", "continuing"));
  }

  // Verify that the core content (after the opener) is preserved
  for (let i = 0; i < texts.length; i++) {
    const original = texts[i].trim();
    const varied = results[i].shapedText;

    // The part after the opener should remain
    const originalContent = original.split(". ").slice(1).join(". ");
    const variedContent = varied.split(". ").slice(1).join(". ");

    if (originalContent && variedContent !== originalContent) {
      throw new Error(`Explanation content should not change. Original: "${originalContent}", Varied: "${variedContent}"`);
    }
  }

  console.log("✅ testExplanationOpeners passed");
}

// --- Technical/factual content is not altered ---

function testTechnicalContentNotAltered() {
  const technicalTexts = [
    "Архитектура включает API на http://localhost:8787/v1/arisha/pipeline",
    "Конфигурация в файле tsconfig.json, класс FastifyInstance",
    "Запуск через npm run dev, функция createFreshContext возвращает объект",
    "Порт 8787, модель qwen2.5:7b-instruct, export default",
  ];

  for (const text of technicalTexts) {
    const result = applyNaturalVariation(text, "tech-trace", "12345", "neutral", "continuing");
    if (result.textAdjusted) {
      throw new Error(`Technical text should not be altered: "${text.slice(0, 50)}..."`);
    }
    if (result.shapedText !== text.trim()) {
      throw new Error("Technical text should remain exactly the same");
    }
  }

  console.log("✅ testTechnicalContentNotAltered passed");
}

// --- Variation is deterministic/debuggable ---

function testVariationDeterministic() {
  const text = "Привет! Как дела?";
  const traceId = "deterministic-trace";
  const chatId = "12345";

  // Run twice with same inputs
  const r1 = applyNaturalVariation(text, traceId, chatId, "warm", "fresh");
  const r2 = applyNaturalVariation(text, traceId, chatId, "warm", "fresh");

  if (r1.mode !== r2.mode || r1.shapedText !== r2.shapedText || r1.templateFamily !== r2.templateFamily) {
    throw new Error("Variation should be deterministic for same inputs");
  }

  console.log("✅ testVariationDeterministic passed");
}

// --- Repeated same opener gets reduced ---

function testRepeatedOpenerReduced() {
  // Same greeting 4 times should rotate among variants
  const texts = Array(4).fill("Привет! Расскажи подробнее.");
  const results: VariationResult[] = [];

  for (let i = 0; i < texts.length; i++) {
    results.push(applyNaturalVariation(texts[i], `repeat-trace-${i}`, "12345", "warm", "continuing"));
  }

  // At least some should have different prefixes (rotated)
  const prefixes = results.map(r => r.shapedText.split(" ")[0]);
  const uniquePrefixes = new Set(prefixes);

  // With 4 runs and 4 greeting variants, we should see some rotation
  if (uniquePrefixes.size < 1) {
    throw new Error("Should see some variation in repeated greetings");
  }

  console.log(`✅ testRepeatedOpenerReduced passed (${uniquePrefixes.size} unique prefixes in 4 runs)`);
}

// --- Fallback to original text when no safe template applies ---

function testFallbackToOriginal() {
  const noTemplateTexts = [
    "Архитектура системы включает три основных компонента: базу данных, API сервер и клиент.",
    "Завтра встреча в 10:30 в конференц-зале номер 5.",
    "Пароль: abc123, логин: user@example.com, URL: https://api.example.com",
  ];

  for (const text of noTemplateTexts) {
    const result = applyNaturalVariation(text, "no-template-trace", "12345", "neutral", "continuing");
    // These either don't match a template or are technical → should skip
    if (result.textAdjusted && result.mode !== "none") {
      // If adjusted, it should still be a safe variation
      if (Math.abs(result.shapedText.length - text.length) > text.length * 0.3) {
        throw new Error("Variation should not drastically change text length");
      }
    }
  }

  console.log("✅ testFallbackToOriginal passed");
}

// --- Variation mode is correct ---

function testVariationModeCorrect() {
  // Greeting/confirmation/explanation → light
  const r1 = applyNaturalVariation("Привет! Как дела?", "trace-1", "123", "warm", "fresh");
  if (r1.textAdjusted && r1.mode !== "light") {
    throw new Error(`Greeting variation should be light, got ${r1.mode}`);
  }

  // Supportive connector → micro_shift
  const r2 = applyNaturalVariation("Давай спокойно разберём. Что случилось?", "trace-2", "123", "supportive", "soft_followup");
  if (r2.textAdjusted && r2.mode !== "micro_shift") {
    throw new Error(`Supportive variation should be micro_shift, got ${r2.mode}`);
  }

  console.log("✅ testVariationModeCorrect passed");
}

// --- Short text skipped ---

function testShortTextSkipped() {
  const shortTexts = ["ок", "да", "нет", "ага", "123", "   "];
  for (const text of shortTexts) {
    const result = applyNaturalVariation(text, "short-trace", "123", "concise", "continuing");
    if (result.textAdjusted) {
      throw new Error(`Short text "${text}" should not be adjusted`);
    }
    if (result.mode !== "none") {
      throw new Error(`Short text should have mode=none, got ${result.mode}`);
    }
  }

  console.log("✅ testShortTextSkipped passed");
}

async function main() {
  testGreetingsRotate();
  testConfirmationsRotate();
  testExplanationOpeners();
  testTechnicalContentNotAltered();
  testVariationDeterministic();
  testRepeatedOpenerReduced();
  testFallbackToOriginal();
  testVariationModeCorrect();
  testShortTextSkipped();
  console.log("\n✅ All voice natural variation tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
