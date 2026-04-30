import type Database from "better-sqlite3";
import type { AgentPolicy } from "../../../runtime-safety-contracts/src/policy.js";
import type { RuntimeIdentity } from "../../../runtime-safety-contracts/src/identity.js";
import type { ScopeBinding } from "../../../runtime-safety-contracts/src/scope.js";

export function createIdentitiesRepo(db: Database.Database) {
  return {
    saveIdentity(identity: RuntimeIdentity): void {
      db.prepare(
        `INSERT OR REPLACE INTO runtime_identities (tele_user_id, workspace_id, store_id, session_id, task_id, agent_id, channel_transport, channel_user_id, channel_chat_id, channel_session_ref, created_at)
         VALUES (@tele_user_id, @workspace_id, @store_id, @session_id, @task_id, @agent_id, @channel_transport, @channel_user_id, @channel_chat_id, @channel_session_ref, @created_at)`
      ).run({
        tele_user_id: identity.tele_user_id,
        workspace_id: identity.workspace_id ?? null,
        store_id: identity.store_id ?? null,
        session_id: identity.session_id ?? null,
        task_id: identity.task_id ?? null,
        agent_id: identity.agent_id ?? null,
        channel_transport: identity.channel_identity?.transport ?? null,
        channel_user_id: identity.channel_identity?.transport_user_id ?? null,
        channel_chat_id: identity.channel_identity?.transport_chat_id ?? null,
        channel_session_ref: identity.channel_identity?.transport_session_ref ?? null,
        created_at: new Date().toISOString(),
      });
    },

    getIdentity(tele_user_id: string): RuntimeIdentity | null {
      const row = db.prepare("SELECT * FROM runtime_identities WHERE tele_user_id = ? ORDER BY created_at DESC LIMIT 1").get(tele_user_id);
      if (!row) return null;
      const r = row as any;
      return {
        tele_user_id: r.tele_user_id,
        workspace_id: r.workspace_id,
        store_id: r.store_id,
        agent_id: r.agent_id,
        session_id: r.session_id,
        task_id: r.task_id,
        channel_identity: r.channel_transport ? {
          transport: r.channel_transport,
          transport_user_id: r.channel_user_id,
          transport_chat_id: r.channel_chat_id,
          transport_session_ref: r.channel_session_ref,
        } : undefined,
      };
    },
  };
}

export function createPoliciesRepo(db: Database.Database) {
  return {
    savePolicy(policy: AgentPolicy): void {
      db.prepare(
        `INSERT OR REPLACE INTO runtime_policies (agent_id, allowed_tools_json, denied_tools_json, allowed_memory_scopes_json, write_requires_approval, external_send_requires_sanitization, max_parallel_jobs, updated_at)
         VALUES (@agent_id, @allowed_tools_json, @denied_tools_json, @allowed_memory_scopes_json, @write_requires_approval, @external_send_requires_sanitization, @max_parallel_jobs, @updated_at)`
      ).run({
        agent_id: policy.agent_id,
        allowed_tools_json: JSON.stringify(policy.allowed_tools),
        denied_tools_json: JSON.stringify(policy.denied_tools),
        allowed_memory_scopes_json: JSON.stringify(policy.allowed_memory_scopes),
        write_requires_approval: policy.write_requires_approval ? 1 : 0,
        external_send_requires_sanitization: policy.external_send_requires_sanitization ? 1 : 0,
        max_parallel_jobs: policy.max_parallel_jobs,
        updated_at: new Date().toISOString(),
      });
    },

    getPolicy(agent_id: string): AgentPolicy | null {
      const row = db.prepare("SELECT * FROM runtime_policies WHERE agent_id = ?").get(agent_id);
      if (!row) return null;
      const r = row as any;
      return {
        agent_id: r.agent_id,
        allowed_tools: JSON.parse(r.allowed_tools_json || "[]"),
        denied_tools: JSON.parse(r.denied_tools_json || "[]"),
        allowed_memory_scopes: JSON.parse(r.allowed_memory_scopes_json || "[]"),
        write_requires_approval: !!r.write_requires_approval,
        external_send_requires_sanitization: !!r.external_send_requires_sanitization,
        max_parallel_jobs: r.max_parallel_jobs,
      };
    },
  };
}

export function createScopeBindingsRepo(db: Database.Database) {
  return {
    saveBinding(binding: ScopeBinding): void {
      db.prepare(
        `INSERT OR REPLACE INTO runtime_scope_bindings (scope_id, tele_user_id, workspace_id, store_id, session_id, task_id, bound_at)
         VALUES (@scope_id, @tele_user_id, @workspace_id, @store_id, @session_id, @task_id, @bound_at)`
      ).run({
        scope_id: binding.scope_id,
        tele_user_id: binding.tele_user_id,
        workspace_id: binding.workspace_id ?? null,
        store_id: binding.store_id ?? null,
        session_id: binding.session_id ?? null,
        task_id: binding.task_id ?? null,
        bound_at: binding.bound_at,
      });
    },

    getBinding(scope_id: string): ScopeBinding | null {
      const row = db.prepare("SELECT * FROM runtime_scope_bindings WHERE scope_id = ?").get(scope_id);
      return row as ScopeBinding | null;
    },
  };
}
