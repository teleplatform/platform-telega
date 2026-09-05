import { HorizonPlan, HorizonPhase, HorizonMilestone, HorizonStatus } from "./horizonTypes";

const plans = new Map<string, HorizonPlan>();

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export const HorizonRegistry = {
  create(
    title: string,
    description: string,
    vision: string,
    tags: string[]
  ): HorizonPlan {
    const now = Date.now();
    const plan: HorizonPlan = {
      id: genId("horizon"),
      title,
      description,
      vision,
      status: "draft",
      phases: [],
      missionIds: [],
      capsuleIds: [],
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      tags,
    };
    plans.set(plan.id, plan);
    return plan;
  },

  get(id: string): HorizonPlan | undefined {
    return plans.get(id);
  },

  getAll(): HorizonPlan[] {
    return Array.from(plans.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  update(id: string, updates: Partial<HorizonPlan>): HorizonPlan | null {
    const existing = plans.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
    plans.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return plans.delete(id);
  },

  addPhase(
    planId: string,
    name: string,
    description: string,
    order: number
  ): HorizonPhase | null {
    const plan = plans.get(planId);
    if (!plan) return null;
    const phase: HorizonPhase = {
      id: genId("phase"),
      name,
      description,
      status: "pending",
      order,
      milestones: [],
      startedAt: null,
      completedAt: null,
    };
    plan.phases.push(phase);
    this.update(planId, { phases: plan.phases });
    return phase;
  },

  addMilestone(
    planId: string,
    phaseId: string,
    title: string,
    description: string,
    missionId: string,
    dueBy: number | null
  ): HorizonMilestone | null {
    const plan = plans.get(planId);
    if (!plan) return null;
    const phase = plan.phases.find((p) => p.id === phaseId);
    if (!phase) return null;

    const milestone: HorizonMilestone = {
      id: genId("ms"),
      title,
      description,
      missionId,
      status: "pending",
      dueBy,
      completedAt: null,
    };
    phase.milestones.push(milestone);
    this.update(planId, { phases: plan.phases });
    return milestone;
  },

  linkMission(planId: string, missionId: string): HorizonPlan | null {
    const plan = plans.get(planId);
    if (!plan) return null;
    if (!plan.missionIds.includes(missionId)) {
      plan.missionIds.push(missionId);
    }
    return this.update(planId, { missionIds: plan.missionIds });
  },

  linkCapsule(planId: string, capsuleId: string): HorizonPlan | null {
    const plan = plans.get(planId);
    if (!plan) return null;
    if (!plan.capsuleIds.includes(capsuleId)) {
      plan.capsuleIds.push(capsuleId);
    }
    return this.update(planId, { capsuleIds: plan.capsuleIds });
  },

  size(): number {
    return plans.size;
  },
};
