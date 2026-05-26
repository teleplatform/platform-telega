import type { BrowserStep, BrowserPlan, VerificationCondition } from "./browser-types.js";

const COMMON_PLANS: Record<string, { steps: BrowserStep[]; screenshotEvery?: boolean }> = {
  "check_page": {
    screenshotEvery: true,
    steps: [
      { id: "s1", type: "browser_extract", label: "Extract page title", params: {}, verify: [{ kind: "title_contains", target: "" }], onFail: "continue" },
      { id: "s2", type: "browser_extract", label: "Extract page text", params: { type: "text" }, onFail: "continue" },
    ],
  },
  "check_element": {
    screenshotEvery: true,
    steps: [
      { id: "s1", type: "browser_extract", label: "Extract page text", params: { type: "text" }, onFail: "continue" },
      { id: "s2", type: "browser_wait", label: "Check element", params: { selector: "", timeoutMs: 5000 }, verify: [{ kind: "element_exists", target: "" }], onFail: "stop" },
    ],
  },
  "fill_and_submit": {
    screenshotEvery: true,
    steps: [
      { id: "s1", type: "browser_type", label: "Type into field", params: { selector: "", text: "" }, onFail: "stop" },
      { id: "s2", type: "browser_click", label: "Click submit", params: { selector: "" }, onFail: "retry", maxRetries: 2 },
      { id: "s3", type: "browser_wait", label: "Wait for result", params: { selector: "", timeoutMs: 10000 }, onFail: "continue" },
    ],
  },
};

function generateStepId(): string {
  return `bs_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
}

function makeSteps(template: BrowserStep[], params: Record<string, string>): BrowserStep[] {
  return template.map(s => {
    const stepParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.params)) {
      stepParams[k] = typeof v === "string" && v === "" ? (params[k] || params[k] || "") : v;
    }
    const stepVerify = s.verify?.map(v => ({
      ...v,
      target: v.target === "" ? (params.target || "") : v.target,
      selector: (!v.selector || v.selector === "") ? (params.selector || v.selector) : v.selector,
    }));
    return { ...s, id: generateStepId(), params: stepParams, verify: stepVerify };
  });
}

export function planFromIntent(intent: string, url: string, params: Record<string, string> = {}): BrowserPlan {
  const planId = `bp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const lower = intent.toLowerCase();

  if (COMMON_PLANS[lower]) {
    return { id: planId, intent, steps: makeSteps(COMMON_PLANS[lower].steps, params), screenshotEvery: COMMON_PLANS[lower].screenshotEvery };
  }

  if (lower.includes("search") || lower.includes("find")) {
    const q = params.query || params.q || params.text || "";
    return {
      id: planId, intent,
      steps: [
        { id: generateStepId(), type: "browser_navigate", label: `Navigate to ${url}`, params: { url, timeoutMs: 15000 }, onFail: "stop" },
        { id: generateStepId(), type: "browser_type", label: `Type "${q}"`, params: { selector: params.selector || "input[type='text'], input[type='search']", text: q }, onFail: "continue" },
        { id: generateStepId(), type: "browser_click", label: "Submit search", params: { selector: params.submitSelector || "button[type='submit'], input[type='submit']" }, onFail: "retry", maxRetries: 2 },
        { id: generateStepId(), type: "browser_wait", label: "Wait for results", params: { selector: params.resultSelector || "main, .results, #results", timeoutMs: 10000 }, onFail: "continue" },
        { id: generateStepId(), type: "browser_extract", label: "Extract results", params: { selector: params.resultSelector || "main, .results, #results" }, onFail: "continue" },
      ],
      screenshotEvery: true,
    };
  }

  if (lower.includes("click") || lower.includes("press") || lower.includes("tap")) {
    return {
      id: planId, intent,
      steps: [
        { id: generateStepId(), type: "browser_click", label: `Click ${params.selector || "element"}`, params: { selector: params.selector || "" }, verify: [{ kind: "element_exists", target: params.selector || "" }], onFail: "retry", maxRetries: 2 },
        { id: generateStepId(), type: "browser_extract", label: "Extract page state", params: { type: "text" }, onFail: "continue" },
      ],
      screenshotEvery: true,
    };
  }

  if (lower.includes("type") || lower.includes("fill") || lower.includes("enter")) {
    return {
      id: planId, intent,
      steps: [
        { id: generateStepId(), type: "browser_type", label: `Type into ${params.selector || "field"}`, params: { selector: params.selector || "", text: params.text || "" }, onFail: "stop" },
        { id: generateStepId(), type: "browser_extract", label: "Verify input", params: { selector: params.selector || "" }, verify: [{ kind: "text_contains", target: params.text || "", selector: params.selector || "" }], onFail: "continue" },
      ],
      screenshotEvery: true,
    };
  }

  const steps: BrowserStep[] = [
    { id: generateStepId(), type: "browser_navigate", label: `Navigate to ${url}`, params: { url, timeoutMs: 15000 }, verify: [{ kind: "url_contains", target: new URL(url).hostname }], onFail: "stop", maxRetries: 1 },
    { id: generateStepId(), type: "browser_extract", label: "Extract page text", params: { type: "text" }, onFail: "continue" },
    { id: generateStepId(), type: "browser_screenshot", label: "Take screenshot", params: { label: "page" }, onFail: "continue" },
  ];

  return { id: planId, intent, steps, screenshotEvery: false,  };
}
