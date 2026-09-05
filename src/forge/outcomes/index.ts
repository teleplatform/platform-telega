export type { Outcome, LearningSignal, ImprovementProposal, ProposalStatus, SignalCategory, OutcomeSummary } from "./outcomeTypes";
export { OutcomeRegistry } from "./outcomeRegistry";
export { detectSignals, getAllSignals, getSignalsByCategory } from "./signalDetector";
export { generateProposals, getAllProposals, getProposalsByStatus, updateProposalStatus } from "./proposalGenerator";
