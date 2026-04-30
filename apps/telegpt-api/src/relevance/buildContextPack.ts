import type { ContextPack as ContextPackType } from "../relevance/types.js";

export function buildContextPack(input: {
  raw_input: { text: string };
  actor_role: string;
  channel: string;
}): ContextPackType {
  return {
    raw_text: input.raw_input?.text ?? "",
    actor_role: input.actor_role,
    channel: input.channel,
    language: "ru",
  };
}
