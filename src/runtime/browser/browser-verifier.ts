import type { VerificationCondition, VerificationResult, BrowserActionResult } from "./browser-types.js";
import { getBrowserSession } from "./browser-session.js";


export async function verifyCondition(condition: VerificationCondition, previousResult?: BrowserActionResult): Promise<VerificationResult> {
  const session = getBrowserSession();
  const page = await session.getPage();
  let actual = "";

  try {
    switch (condition.kind) {
      case "title_contains": {
        actual = await page.title();
        break;
      }
      case "url_contains": {
        actual = page.url();
        break;
      }
      case "element_exists": {
        if (condition.selector) {
          const count = await page.locator(condition.selector).count();
          actual = String(count > 0);
        } else if (previousResult?.elementFound !== undefined) {
          actual = String(previousResult.elementFound);
        } else {
          actual = "unknown";
        }
        break;
      }
      case "text_contains": {
        if (condition.selector) {
          actual = (await session.extractText(condition.selector)) || "";
        } else {
          actual = previousResult?.text || (await session.extractText()) || "";
        }
        break;
      }
      case "text_not_contains": {
        if (condition.selector) {
          actual = (await session.extractText(condition.selector)) || "";
        } else {
          actual = previousResult?.text || (await session.extractText()) || "";
        }
        break;
      }
    }
  } catch {
    actual = "";
  }

  let passed = false;
  switch (condition.kind) {
    case "title_contains":
      passed = actual.toLowerCase().includes(condition.target.toLowerCase());
      break;
    case "url_contains":
      passed = actual.toLowerCase().includes(condition.target.toLowerCase());
      break;
    case "element_exists":
      passed = actual === "true";
      break;
    case "text_contains":
      passed = actual.toLowerCase().includes(condition.target.toLowerCase());
      break;
    case "text_not_contains":
      passed = !actual.toLowerCase().includes(condition.target.toLowerCase());
      break;
  }

  return { condition, passed, actual: actual.slice(0, 500) };
}

export async function verifyAll(
  conditions: VerificationCondition[],
  previousResult?: BrowserActionResult,
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const c of conditions) {
    results.push(await verifyCondition(c, previousResult));
  }
  return results;
}
