export interface AttentionPlan {
  primary_focus: string;
  response_shape: {
    lead_with: string;
    branching: string;
    depth: string;
  };
}