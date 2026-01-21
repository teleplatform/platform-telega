import type { AgentTemplate, KnowledgePack } from "../types/agent.js";

export function buildAgentSystemPrompt(
  template: AgentTemplate,
  knowledge?: KnowledgePack
): string {
  const parts: string[] = [];

  // Role definition
  const roleMap = {
    sales: "Sales Representative",
    support: "Customer Support Agent",
    operator: "Customer Service Operator",
  };
  const roleName = template.name || roleMap[template.role];
  parts.push(`You are ${roleName}.`);

  // Personality
  if (template.personality) {
    parts.push(template.personality);
  }

  // Business context
  if (knowledge?.business_name) {
    parts.push(`You work for ${knowledge.business_name}.`);
  }
  if (knowledge?.description) {
    parts.push(knowledge.description);
  }

  // Instructions
  if (template.instructions && template.instructions.length > 0) {
    parts.push("\nYour responsibilities:");
    template.instructions.forEach((inst) => {
      parts.push(`- ${inst}`);
    });
  }

  // Knowledge sections
  if (knowledge) {
    if (knowledge.pricing && knowledge.pricing.length > 0) {
      parts.push("\n## Pricing");
      knowledge.pricing.forEach((item) => {
        const details = item.details ? ` (${item.details})` : "";
        parts.push(`- ${item.item}: ${item.price}${details}`);
      });
    }

    if (knowledge.faq && knowledge.faq.length > 0) {
      parts.push("\n## Common Questions");
      knowledge.faq.forEach((faq) => {
        parts.push(`Q: ${faq.question}`);
        parts.push(`A: ${faq.answer}`);
      });
    }

    if (knowledge.policies && knowledge.policies.length > 0) {
      parts.push("\n## Policies");
      knowledge.policies.forEach((policy) => {
        parts.push(`**${policy.title}**: ${policy.content}`);
      });
    }

    if (knowledge.contacts) {
      const c = knowledge.contacts;
      parts.push("\n## Contact Information");
      if (c.phone) parts.push(`Phone: ${c.phone}`);
      if (c.email) parts.push(`Email: ${c.email}`);
      if (c.address) parts.push(`Address: ${c.address}`);
      if (c.hours) parts.push(`Hours: ${c.hours}`);
    }
  }

  // Constraints
  if (template.constraints && template.constraints.length > 0) {
    parts.push("\n## Important Guidelines");
    template.constraints.forEach((constraint) => {
      parts.push(`- ${constraint}`);
    });
  }

  return parts.join("\n");
}

export const DEFAULT_SALES_TEMPLATE: AgentTemplate = {
  role: "sales",
  personality:
    "You are helpful, professional, and focused on understanding customer needs.",
  instructions: [
    "Greet customers warmly and professionally",
    "Listen carefully to understand their needs",
    "Provide accurate information about products and pricing",
    "Answer questions clearly and concisely",
    "Guide customers toward appropriate solutions",
  ],
  constraints: [
    "Always be polite and respectful",
    "Never make promises about things not in your knowledge base",
    "If you don't know something, say so and offer to connect them with someone who can help",
    "Keep responses concise and relevant",
  ],
};

export const DEFAULT_SUPPORT_TEMPLATE: AgentTemplate = {
  role: "support",
  personality:
    "You are empathetic, patient, and dedicated to solving customer problems.",
  instructions: [
    "Acknowledge customer concerns with empathy",
    "Ask clarifying questions to understand the issue",
    "Provide step-by-step solutions when applicable",
    "Escalate complex issues appropriately",
    "Follow up to ensure satisfaction",
  ],
  constraints: [
    "Always validate customer feelings before problem-solving",
    "Never blame the customer for issues",
    "If a solution isn't in your knowledge base, offer to escalate",
    "Maintain professional boundaries",
  ],
};
