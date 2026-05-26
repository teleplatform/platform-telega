import { TaskType, RuntimeCapability, CapabilityRoute } from './sigma-forge-types.js';

const ROUTES: CapabilityRoute[] = [
  { capability: 'browser', taskType: 'browser.navigate', handler: 'navigate' },
  { capability: 'browser', taskType: 'browser.click', handler: 'click' },
  { capability: 'browser', taskType: 'browser.type', handler: 'type' },
  { capability: 'browser', taskType: 'browser.extract', handler: 'extract' },
  { capability: 'browser', taskType: 'browser.screenshot', handler: 'screenshot' },
  { capability: 'browser', taskType: 'browser.wait', handler: 'wait' },
  { capability: 'browser', taskType: 'browser.search', handler: 'search' },
  { capability: 'browser', taskType: 'browser.verify_condition', handler: 'verify' },
  { capability: 'memory', taskType: 'memory.store', handler: 'store' },
  { capability: 'memory', taskType: 'memory.retrieve', handler: 'retrieve' },
  { capability: 'memory', taskType: 'memory.search', handler: 'search' },
  { capability: 'execution', taskType: 'execution.shell', handler: 'shell' },
  { capability: 'execution', taskType: 'execution.http', handler: 'http' },
  { capability: 'execution', taskType: 'execution.file_read', handler: 'file_read' },
  { capability: 'execution', taskType: 'execution.file_write', handler: 'file_write' },
  { capability: 'execution', taskType: 'execution.verify', handler: 'verify' },
  { capability: 'evidence', taskType: 'evidence.record', handler: 'record' },
  { capability: 'evidence', taskType: 'evidence.verify', handler: 'verify' },
  { capability: 'evidence', taskType: 'evidence.export', handler: 'export' },
  { capability: 'governance', taskType: 'governance.check', handler: 'check' },
  { capability: 'goals', taskType: 'goals.create', handler: 'create' },
  { capability: 'goals', taskType: 'goals.update', handler: 'update' },
  { capability: 'goals', taskType: 'goals.complete', handler: 'complete' },
  { capability: 'evidence', taskType: 'artifact.register', handler: 'register_artifact' },
  { capability: 'evidence', taskType: 'mission.summary', handler: 'mission_summary' },
];

export function getCapability(taskType: TaskType): RuntimeCapability {
  const route = ROUTES.find(r => r.taskType === taskType);
  if (!route) throw new Error(`No capability route for task type: ${taskType}`);
  return route.capability;
}

export function getRoute(taskType: TaskType): CapabilityRoute {
  const route = ROUTES.find(r => r.taskType === taskType);
  if (!route) throw new Error(`No capability route for task type: ${taskType}`);
  return route;
}

export function getTaskTypesByCapability(capability: RuntimeCapability): TaskType[] {
  return ROUTES.filter(r => r.capability === capability).map(r => r.taskType);
}

export function getAllRoutes(): CapabilityRoute[] {
  return [...ROUTES];
}
