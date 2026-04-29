import { useState, useEffect, useCallback } from "react";
import type {
  ForgeWorkflow,
  ForgeTask,
  ForgeTimeline,
  ForgeGraph,
  ForgeDashboard,
  KiloPatchPlan,
} from "../types/forge";

const API_BASE = "";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useForgeDashboard() {
  const [dashboard, setDashboard] = useState<ForgeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<ForgeDashboard>(`${API_BASE}/forge/dashboard`);
      setDashboard(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}

export function useForgeWorkflows() {
  const [workflows, setWorkflows] = useState<ForgeWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ workflows: ForgeWorkflow[] }>(`${API_BASE}/forge/workflows`);
      setWorkflows(data.workflows);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { workflows, loading, refresh };
}

export function useForgeTasks() {
  const [tasks, setTasks] = useState<ForgeTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ tasks: ForgeTask[] }>(`${API_BASE}/forge/tasks`);
      setTasks(data.tasks);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { tasks, loading, refresh };
}

export function useForgeTimelines(workflowId?: string) {
  const [timelines, setTimelines] = useState<ForgeTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ timelines: ForgeTimeline[] }>(`${API_BASE}/forge/timelines`);
      setTimelines(
        workflowId
          ? data.timelines.filter((t) => t.workflow_id === workflowId)
          : data.timelines
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { timelines, loading, refresh };
}

export function useForgeGraph(workflowId?: string) {
  const [graphs, setGraphs] = useState<ForgeGraph[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ graphs: ForgeGraph[] }>(`${API_BASE}/forge/task-graph`);
      setGraphs(
        workflowId
          ? data.graphs.filter((g) => g.workflow_id === workflowId)
          : data.graphs
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { graphs, loading, refresh };
}

export function useForgePatches() {
  const [patches, setPatches] = useState<KiloPatchPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ patches: KiloPatchPlan[] }>(`${API_BASE}/forge/patches`);
      setPatches(data.patches);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { patches, loading, refresh };
}

export function useForgePatch(id: string) {
  const [patch, setPatch] = useState<KiloPatchPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<{ patch?: KiloPatchPlan; error?: string }>(
        `${API_BASE}/forge/patch/${id}`
      );
      if (data.error) {
        setError(data.error);
        setPatch(null);
      } else {
        setPatch(data.patch ?? null);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { patch, loading, error, refresh };
}

export function useForgeAutoModes() {
  const [autoModes, setAutoModes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ autoModes: any[] }>(`${API_BASE}/forge/auto-modes`);
      setAutoModes(data.autoModes ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { autoModes, loading, refresh };
}

export function useForgeActionCards() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ cards: any[] }>(`${API_BASE}/forge/action-cards`);
      setCards(data.cards ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { cards, loading, refresh };
}

export function useForgeAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const execute = useCallback(
    async (action: string, params?: { workflow_id?: string; patch_id?: string }) => {
      try {
        setLoading(true);
        setError(null);
        const data = await postJson<any>(`${API_BASE}/api/forge/action`, {
          action,
          ...params,
        });
        setResult(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Action failed";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { execute, loading, error, result };
}