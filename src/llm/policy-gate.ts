export class PolicyGate {
  evaluate(input: {
    provider: string;
    mode: string;
    consent: boolean;
  }): "PASS" | "HARD_DENY" {
    if (input.provider === "creator_bridge") {
      if (input.mode !== "creator") return "HARD_DENY";
      if (!input.consent) return "HARD_DENY";
    }

    return "PASS";
  }
}
