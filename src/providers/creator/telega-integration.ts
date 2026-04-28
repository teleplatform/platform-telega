import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const WORKFLOWS_FILE = path.join(TELEGA_DIR, "workflows.jsonl");
const RESULTS_FILE = path.join(TELEGA_DIR, "action-results.jsonl");

export type WorkflowType = "product_card" | "seller_assistant" | "market_research" | "content" | "ops";
export type WorkflowStatus = "pending" | "running" | "completed" | "failed";

export interface Workflow {
  workflow_id: string;
  type: WorkflowType;
  user_id: string;
  input: string;
  status: WorkflowStatus;
  provider?: string;
  output?: any;
  quality_score?: number;
  suggestions?: string[];
  language?: "ru" | "en" | "uz";
  created_at: number;
  completed_at?: number;
  evidence_id?: string;
  audit_id?: string;
}

export interface ActionResult {
  result_id: string;
  workflow_id: string;
  user_id: string;
  action_type: string;
  input: string;
  output: string;
  language: string;
  approved: boolean;
  executed: boolean;
  created_at: number;
  executed_at?: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendWorkflow(workflow: Workflow): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(workflow) + "\n";
    await fs.appendFile(WORKFLOWS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[telega] workflow write failed", e);
  }
}

export async function appendActionResult(result: ActionResult): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(result) + "\n";
    await fs.appendFile(RESULTS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[telega] result write failed", e);
  }
}

export async function loadWorkflows(userId?: string, limit = 20): Promise<Workflow[]> {
  const workflows: Workflow[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(WORKFLOWS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.workflow_id) {
          if (!userId || parsed.user_id === userId) {
            workflows.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return workflows.sort((a, b) => b.created_at - a.created_at);
}

export async function loadActionResults(workflowId?: string, limit = 20): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(RESULTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.result_id) {
          if (!workflowId || parsed.workflow_id === workflowId) {
            results.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return results.sort((a, b) => b.created_at - a.created_at);
}

export async function getWorkflow(workflowId: string): Promise<Workflow | null> {
  const workflows = await loadWorkflows(undefined, 1000);
  return workflows.find(w => w.workflow_id === workflowId) || null;
}

export async function createWorkflow(
  userId: string,
  type: WorkflowType,
  input: string,
  language: "ru" | "en" | "uz" = "ru"
): Promise<Workflow> {
  const workflow: Workflow = {
    workflow_id: makeId("wf"),
    type,
    user_id: userId,
    input,
    status: "pending",
    language,
    created_at: Date.now(),
  };
  await appendWorkflow(workflow);
  return workflow;
}

export async function updateWorkflow(
  workflowId: string,
  updates: Partial<Workflow>
): Promise<void> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) return;
  
  const updated = { ...workflow, ...updates };
  await appendWorkflow(updated);
}

export async function createActionResult(
  workflowId: string,
  userId: string,
  actionType: string,
  input: string,
  output: string,
  language: "ru" | "en" | "uz" = "ru"
): Promise<ActionResult> {
  const result: ActionResult = {
    result_id: makeId("ar"),
    workflow_id: workflowId,
    user_id: userId,
    action_type: actionType,
    input,
    output,
    language,
    approved: false,
    executed: false,
    created_at: Date.now(),
  };
  await appendActionResult(result);
  return result;
}

export function detectWorkflowType(input: string): WorkflowType {
  const lower = input.toLowerCase();
  
  if (lower.includes("товар") || lower.includes("продукт") || lower.includes("card") || lower.includes("категория") || lower.includes("тег")) {
    return "product_card";
  }
  if (lower.includes("faq") || lower.includes("вопрос") || lower.includes("ответ") || lower.includes("продавец") || lower.includes("заказ") || lower.includes("статус")) {
    return "seller_assistant";
  }
  if (lower.includes("исследование") || lower.includes("research") || lower.includes("конкурент") || lower.includes("рынок") || lower.includes("цена") || lower.includes("позиционирование")) {
    return "market_research";
  }
  if (lower.includes("контент") || lower.includes("post") || lower.includes("story") || lower.includes("промо") || lower.includes("текст")) {
    return "content";
  }
  if (lower.includes("audit") || lower.includes("evidence") || lower.includes("job") || lower.includes("отчёт") || lower.includes("admin") || lower.includes("опс")) {
    return "ops";
  }
  
  return "content";
}

export function formatWorkflowTypes(): string {
  return `📋 Available Workflows:

1. product_card - Generate title, description, tags, category
2. seller_assistant - FAQ, order explanations, tips
3. market_research - Competitor research, pricing
4. content - Posts, stories, promo texts
5. ops - Audit reports, admin summaries`;
}

export function formatWorkflow(workflow: Workflow): string {
  const statusIcon = workflow.status === "completed" ? "✅" : workflow.status === "failed" ? "❌" : workflow.status === "running" ? "🔄" : "⏳";
  const lines = [
    `${statusIcon} Workflow: ${workflow.type}`,
    `ID: ${workflow.workflow_id}`,
    `Input: ${workflow.input.slice(0, 100)}${workflow.input.length > 100 ? "..." : ""}`,
    `Language: ${workflow.language || "ru"}`,
    `Status: ${workflow.status}`,
  ];
  
  if (workflow.provider) lines.push(`Provider: ${workflow.provider}`);
  if (workflow.quality_score !== undefined) lines.push(`Quality: ${workflow.quality_score}%`);
  if (workflow.suggestions?.length) lines.push(`\nSuggestions:\n${workflow.suggestions.map(s => "• " + s).join("\n")}`);
  
  return lines.join("\n");
}

export function formatWorkflowList(workflows: Workflow[]): string {
  if (workflows.length === 0) return "No workflows found";
  
  const lines = [`📋 Workflows (${workflows.length}):\n`];
  for (const w of workflows.slice(0, 10)) {
    const statusIcon = w.status === "completed" ? "✅" : w.status === "failed" ? "❌" : w.status === "running" ? "🔄" : "⏳";
    lines.push(`${statusIcon} ${w.type}: ${w.input.slice(0, 40)}... (${w.workflow_id})`);
  }
  return lines.join("\n");
}

export async function generateProductCard(
  input: string,
  language: "ru" | "en" | "uz" = "ru"
): Promise<{ title: string; description: string; tags: string[]; category: string; quality_score: number; suggestions: string[] }> {
  const title = generateTitle(input, language);
  const description = generateDescription(input, language);
  const tags = generateTags(input, language);
  const category = detectCategory(input);
  const quality_score = calculateQuality(title, description, tags);
  const suggestions = generateSuggestions(title, description, tags, quality_score);
  
  return { title, description, tags, category, quality_score, suggestions };
}

function generateTitle(input: string, lang: "ru" | "en" | "uz"): string {
  const words = input.split(/\s+/).slice(0, 5);
  if (lang === "ru") return `Купить ${words.join(" ")} - Официальный магазин`;
  if (lang === "uz") return `Sotib oling: ${words.join(" ")}`;
  return `Buy ${words.join(" ")} - Official Store`;
}

function generateDescription(input: string, lang: "ru" | "en" | "uz"): string {
  if (lang === "ru") return `Качественный ${input.toLowerCase()}. Доставка по всей России. Гарантия. Оплата при получении.`;
  if (lang === "uz") return `Sifatli ${input.toLowerCase()}. Butun O'zbekiston bo'ylab yetkazish. Kafolat.`;
  return `High-quality ${input.toLowerCase()}. Delivery across the country. Warranty.`;
}

function generateTags(input: string, lang: "ru" | "en" | "uz"): string[] {
  const base = input.toLowerCase().split(/\s+/).slice(0, 5);
  if (lang === "ru") return [...base, "купить", "скидка", "доставка"];
  if (lang === "uz") return [...base, "sotib olish", "chegirma", "yetkazish"];
  return [...base, "buy", "discount", "delivery"];
}

function detectCategory(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("телефон") || lower.includes("phone") || lower.includes("смартфон")) return "electronics";
  if (lower.includes("одежда") || lower.includes("clothes") || lower.includes("платье")) return "fashion";
  if (lower.includes("обувь") || lower.includes("shoes")) return "shoes";
  if (lower.includes("косметика") || lower.includes("cosmetic")) return "beauty";
  if (lower.includes("игрушка") || lower.includes("toy")) return "toys";
  if (lower.includes("книга") || lower.includes("book")) return "books";
  return "other";
}

function calculateQuality(title: string, description: string, tags: string[]): number {
  let score = 50;
  if (title.length > 10 && title.length < 80) score += 15;
  if (description.length > 30 && description.length < 200) score += 15;
  if (tags.length >= 3 && tags.length <= 10) score += 10;
  if (title.includes("Купить") || title.includes("Buy") || title.includes("Sotib")) score += 5;
  if (description.includes("Гарантия") || title.includes("Warranty")) score += 5;
  return Math.min(100, score);
}

function generateSuggestions(title: string, description: string, tags: string[], quality: number): string[] {
  const suggestions: string[] = [];
  if (quality < 70) suggestions.push("Add more keywords to title");
  if (description.length < 50) suggestions.push("Expand description with benefits");
  if (tags.length < 3) suggestions.push("Add more relevant tags");
  if (!description.includes("доставка") && !description.includes("delivery")) suggestions.push("Add delivery info");
  if (suggestions.length === 0) suggestions.push("Product card looks good!");
  return suggestions;
}