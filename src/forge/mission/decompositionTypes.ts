export type DecomposedGoalPriority = "critical" | "high" | "medium" | "low";

export type SuggestedAgent = "planner" | "coder" | "designer" | "tester" | "verifier" | "researcher";

export interface DecomposedGoal {
  title: string;
  description: string;
  priority: DecomposedGoalPriority;
  dependsOn: string[];
  suggestedAgent: SuggestedAgent;
  estimatedEffort: "small" | "medium" | "large";
}

export interface GoalDecompositionResult {
  mission: string;
  goals: DecomposedGoal[];
  totalGoals: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export const DEPLOY_AGENTS: Record<string, SuggestedAgent> = {
  schema: "planner",
  database: "planner",
  design: "designer",
  ui: "designer",
  frontend: "coder",
  backend: "coder",
  api: "coder",
  route: "coder",
  test: "tester",
  verify: "verifier",
  lint: "verifier",
  review: "verifier",
  deploy: "verifier",
  capsule: "verifier",
  research: "researcher",
  analyze: "researcher",
  document: "researcher",
  planning: "planner",
  architecture: "planner",
};

export const DOMAIN_TEMPLATES: Record<string, DecomposedGoal[]> = {
  crm: [
    { title: "Design database schema for CRM", description: "Users, clients, bookings, payments tables", priority: "critical", dependsOn: [], suggestedAgent: "planner", estimatedEffort: "medium" },
    { title: "Implement CRM API routes", description: "CRUD for clients, bookings, payments", priority: "high", dependsOn: ["Design database schema for CRM"], suggestedAgent: "coder", estimatedEffort: "large" },
    { title: "Build CRM UI", description: "Client list, booking calendar, payment status", priority: "high", dependsOn: ["Implement CRM API routes"], suggestedAgent: "designer", estimatedEffort: "large" },
    { title: "Run verification suite", description: "End-to-end tests, lint, typecheck", priority: "critical", dependsOn: ["Build CRM UI"], suggestedAgent: "tester", estimatedEffort: "medium" },
  ],
  api: [
    { title: "Design API contract", description: "OpenAPI schema, types, routes", priority: "critical", dependsOn: [], suggestedAgent: "planner", estimatedEffort: "medium" },
    { title: "Implement API endpoints", description: "All routes per contract", priority: "high", dependsOn: ["Design API contract"], suggestedAgent: "coder", estimatedEffort: "large" },
    { title: "Add API tests", description: "Integration tests for all endpoints", priority: "high", dependsOn: ["Implement API endpoints"], suggestedAgent: "tester", estimatedEffort: "medium" },
    { title: "Verify and document API", description: "Typecheck, lint, OpenAPI docs", priority: "critical", dependsOn: ["Add API tests"], suggestedAgent: "verifier", estimatedEffort: "small" },
  ],
  webapp: [
    { title: "Design application architecture", description: "Component tree, data flow, routing", priority: "critical", dependsOn: [], suggestedAgent: "planner", estimatedEffort: "medium" },
    { title: "Build core UI components", description: "Layout, navigation, shared components", priority: "high", dependsOn: ["Design application architecture"], suggestedAgent: "designer", estimatedEffort: "large" },
    { title: "Implement business logic", description: "State management, API integration", priority: "high", dependsOn: ["Build core UI components"], suggestedAgent: "coder", estimatedEffort: "large" },
    { title: "Add tests and verify", description: "Component tests, e2e, typecheck", priority: "critical", dependsOn: ["Implement business logic"], suggestedAgent: "tester", estimatedEffort: "medium" },
  ],
  default: [
    { title: "Research and plan", description: "Understand requirements, plan architecture", priority: "critical", dependsOn: [], suggestedAgent: "planner", estimatedEffort: "medium" },
    { title: "Implement core logic", description: "Main implementation", priority: "high", dependsOn: ["Research and plan"], suggestedAgent: "coder", estimatedEffort: "large" },
    { title: "Add tests", description: "Unit and integration tests", priority: "high", dependsOn: ["Implement core logic"], suggestedAgent: "tester", estimatedEffort: "medium" },
    { title: "Verify and create capsule", description: "Final verification, lint, capsule build", priority: "critical", dependsOn: ["Add tests"], suggestedAgent: "verifier", estimatedEffort: "small" },
  ],
};
