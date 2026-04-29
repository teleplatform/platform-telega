import { useState, useEffect, useCallback } from "react";
import type {
  ForgeWorkflow,
  ForgeTask,
  ForgeTimeline,
  ForgeGraph,
  ForgeDashboard,
} from "../types/forge";

const API_BASE = "";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
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