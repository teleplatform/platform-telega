import fs from 'node:fs';
import path from 'node:path';
import type { MeshNodeInfo } from './mesh-node-types.js';

const STORE_PATH = path.join(process.cwd(), '.data', 'runtime', 'mesh-nodes.jsonl');

const nodeCache: MeshNodeInfo[] = [];
let cacheLoaded = false;

function load(): void {
  if (cacheLoaded) return;
  if (!fs.existsSync(STORE_PATH)) {
    cacheLoaded = true;
    return;
  }
  nodeCache.length = 0;
  try {
    const content = fs.readFileSync(STORE_PATH, 'utf8');
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        nodeCache.push(JSON.parse(line) as MeshNodeInfo);
      } catch { }
    }
  } catch { }
  cacheLoaded = true;
}

function saveAll(): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = nodeCache.map(n => JSON.stringify(n)).join('\n') + '\n';
    fs.writeFileSync(STORE_PATH, lines, 'utf8');
  } catch { }
}

export function persistMeshNode(node: MeshNodeInfo): void {
  load();
  const idx = nodeCache.findIndex(n => n.id === node.id);
  if (idx >= 0) {
    nodeCache[idx] = node;
  } else {
    nodeCache.push(node);
  }
  saveAll();
}

export function removeMeshNode(nodeId: string): void {
  load();
  const idx = nodeCache.findIndex(n => n.id === nodeId);
  if (idx >= 0) {
    nodeCache.splice(idx, 1);
    saveAll();
  }
}

export function loadMeshNodes(): MeshNodeInfo[] {
  load();
  return [...nodeCache];
}

export function loadMeshNode(nodeId: string): MeshNodeInfo | undefined {
  load();
  return nodeCache.find(n => n.id === nodeId);
}

export function getMeshNodeCount(): number {
  load();
  return nodeCache.length;
}

export function clearMeshNodeStore(): void {
  nodeCache.length = 0;
  try {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  } catch { }
}

export function meshNodeStoreSummary(): string {
  load();
  const online = nodeCache.filter(n => n.status === 'online').length;
  const offline = nodeCache.filter(n => n.status === 'offline' || n.status === 'dead').length;
  return `Mesh node store: ${nodeCache.length} nodes (${online} online, ${offline} offline)`;
}
