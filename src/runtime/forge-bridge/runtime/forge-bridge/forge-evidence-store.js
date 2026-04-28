// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE STORE v1
//
// JSONL append-only persistent store for evidence records.
// Provides durability beyond process lifetime.
//
// Operations:
// - append(record) -> append to file
// - update(invocationId, patch) -> append updated record
// - list(query) -> buffered reader with filtering
// - getByInvocationId(invocationId) -> latest or null
// - getByTaskId(taskId) -> latest or null
// - syncToMemory() -> reload all to memory index
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { appendFileSync, readFileSync } from "node:fs";
import { getInvocationEvidence, listInvocationEvidence, } from "./forge-invocation-evidence.js";
const DEFAULT_STORE_DIR = "./data/forge-evidence";
const DEFAULT_FILE_NAME = "evidence.jsonl";
let storeConfig = null;
let currentFilePath = null;
function getDateStamp() {
    return new Date().toISOString().slice(0, 10);
}
function getStoreFilePath() {
    if (!storeConfig) {
        storeConfig = { storeDir: DEFAULT_STORE_DIR };
    }
    const dir = storeConfig.storeDir;
    const fileName = storeConfig.rotateDaily
        ? `evidence-${getDateStamp()}.jsonl`
        : DEFAULT_FILE_NAME;
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return join(dir, fileName);
}
export function initEvidenceStore(config) {
    storeConfig = config;
    currentFilePath = getStoreFilePath();
    console.log(`[evidence-store] initialized: ${currentFilePath}`);
}
export function getEvidenceStoreConfig() {
    if (!storeConfig) {
        storeConfig = { storeDir: DEFAULT_STORE_DIR };
    }
    return storeConfig;
}
export async function appendEvidenceToStore(record) {
    const filePath = getStoreFilePath();
    const line = JSON.stringify(record) + "\n";
    try {
        appendFileSync(filePath, line, { encoding: "utf8" });
        console.log(`[evidence-store] appended: invocationId=${record.invocationId} status=${record.status}`);
    }
    catch (e) {
        console.error(`[evidence-store] append error:`, e.message);
        throw e;
    }
}
export async function updateEvidenceInStore(invocationId, patch) {
    const current = getInvocationEvidence(invocationId);
    if (!current) {
        console.warn(`[evidence-store] update failed: invocationId=${invocationId} not found`);
        return null;
    }
    const updated = {
        ...current,
        ...patch,
    };
    await appendEvidenceToStore(updated);
    return updated;
}
export async function listEvidenceFromStore(query) {
    const filePath = getStoreFilePath();
    if (!existsSync(filePath)) {
        return [];
    }
    const records = [];
    const content = readFileSync(filePath, { encoding: "utf8" });
    const lines = content.split("\n").filter((line) => line.trim());
    for (const line of lines) {
        try {
            const record = JSON.parse(line);
            if (matchesQuery(record, query)) {
                records.push(record);
            }
        }
        catch {
            // skip malformed lines
        }
    }
    return applyOrdering(records, query);
}
function matchesQuery(record, query) {
    if (!query)
        return true;
    if (query.invocationId && record.invocationId !== query.invocationId) {
        return false;
    }
    if (query.taskId && record.taskId !== query.taskId) {
        return false;
    }
    if (query.userId && record.userId !== query.userId) {
        return false;
    }
    if (query.role && record.role !== query.role) {
        return false;
    }
    if (query.target && record.target !== query.target) {
        return false;
    }
    if (query.kind && record.kind !== query.kind) {
        return false;
    }
    if (query.status && record.status !== query.status) {
        return false;
    }
    if (query.startedAfter) {
        const after = new Date(query.startedAfter).getTime();
        if (new Date(record.startedAt).getTime() < after) {
            return false;
        }
    }
    if (query.startedBefore) {
        const before = new Date(query.startedBefore).getTime();
        if (new Date(record.startedAt).getTime() > before) {
            return false;
        }
    }
    if (query.finishedAfter && record.finishedAt) {
        const after = new Date(query.finishedAfter).getTime();
        if (new Date(record.finishedAt).getTime() < after) {
            return false;
        }
    }
    if (query.finishedBefore && record.finishedAt) {
        const before = new Date(query.finishedBefore).getTime();
        if (new Date(record.finishedAt).getTime() > before) {
            return false;
        }
    }
    return true;
}
function applyOrdering(records, query) {
    const orderBy = query?.orderBy || "startedAt";
    const order = query?.order || "desc";
    const sorted = [...records].sort((a, b) => {
        const aVal = a[orderBy] || "";
        const bVal = b[orderBy] || "";
        const cmp = aVal.localeCompare(bVal);
        return order === "asc" ? cmp : -cmp;
    });
    const offset = query?.offset || 0;
    const limit = query?.limit || sorted.length;
    return sorted.slice(offset, offset + limit);
}
export async function getEvidenceByInvocationId(invocationId) {
    const results = await listEvidenceFromStore({ invocationId });
    return results[0] || null;
}
export async function getEvidenceByTaskId(taskId) {
    const results = await listEvidenceFromStore({ taskId });
    return results[0] || null;
}
export async function getEvidenceCount() {
    const filePath = getStoreFilePath();
    if (!existsSync(filePath)) {
        return 0;
    }
    const content = readFileSync(filePath, { encoding: "utf8" });
    const lines = content.split("\n").filter((line) => line.trim());
    return lines.length;
}
export async function syncMemoryToStore() {
    const memoryRecords = listInvocationEvidence();
    let synced = 0;
    for (const record of memoryRecords) {
        const existing = await getEvidenceByInvocationId(record.invocationId);
        if (!existing) {
            await appendEvidenceToStore(record);
            synced++;
        }
    }
    console.log(`[evidence-store] synced ${synced} records from memory`);
    return synced;
}
