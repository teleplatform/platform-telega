export interface ConsoleSummaryCard {
  id: string;
  label: string;
  value: number | string;
  icon: string;
  trend?: "up" | "down" | "stable";
  severity?: "ok" | "warning" | "critical";
}

export interface ConsoleSection {
  id: string;
  title: string;
  type: "summary" | "list" | "actions" | "digest" | "emergency";
  data: unknown;
}

export interface OperatorConsole {
  summaryCards: ConsoleSummaryCard[];
  sections: ConsoleSection[];
  mode: "operator";
  generatedAt: string;
}
