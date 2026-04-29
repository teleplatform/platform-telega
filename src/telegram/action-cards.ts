import { Language } from "../providers/creator/i18n.js";
import { Markup } from "telegraf";
import {
  findActionCards,
  renderActionCard,
  getSeverityColor,
  type CommandContext,
  type ActionCard,
} from "../lib/commands.js";

export interface ActionCardContext extends CommandContext {
  chat_id?: string;
  user_id?: string;
}

export function shouldRenderActionCards(context: ActionCardContext): boolean {
  return (
    context.has_active_workflow ||
    context.has_stalled_workflow ||
    context.has_pending_heal ||
    !!context.last_error ||
    !!context.current_workflow_id
  );
}

export async function renderActionCardsForContext(
  context: ActionCardContext,
  lang: Language = "ru"
): Promise<{ text: string; buttons?: any[] }[]> {
  const cards = findActionCards(context as CommandContext);

  if (cards.length === 0) return [];

  return cards.slice(0, 2).map((card) => ({
    text: renderActionCard(card, lang),
    buttons: undefined,
  }));
}

export async function buildActionCardButtons(
  card: ActionCard,
  lang: Language = "ru"
): Promise<any[]> {
  const buttons = card.commands.slice(0, 3).map((cmd) => {
    const label = lang === "ru" ? cmd : cmd;
    return Markup.button.callback(label, `ac:${card.card_id}:${cmd}`);
  });

  return buttons;
}

export async function renderActionCardsWithButtons(
  context: ActionCardContext,
  lang: Language = "ru"
): Promise<{ text: string; buttons: any } | null> {
  const cards = findActionCards(context as CommandContext);

  if (cards.length === 0) return null;

  const card = cards[0];
  const text = renderActionCard(card, lang);
  const buttons = await buildActionCardButtons(card, lang);

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  return {
    text: `${text}\n\nВыберите действие / Choose action:`,
    buttons: Markup.inlineMarkup(rows),
  };
}

export const ACTION_CARD_EVIDENCE = [
  "action_card_rendered",
  "action_card_clicked",
  "action_card_dismissed",
];

export function logActionCardEvent(
  event: string,
  card_id: string,
  user_id: string,
  action?: string
): void {
  console.log(`[action-card] ${event}`, { card_id, user_id, action, ts: Date.now() });
}