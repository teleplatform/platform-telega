import { IntentTemplate, TaskType } from './sigma-forge-types.js';

const WEB_RESEARCH: IntentTemplate = {
  name: 'web_research',
  keywords: ['check', 'проверь', 'research', 'extract', 'найди', 'search', 'find', 'look up'],
  phases: [
    {
      name: 'browser_search',
      description: 'Navigate to target and search for information',
      tasks: [{ taskType: 'browser.navigate', label: 'Navigate to target', params: {}, maxRetries: 2 }],
      dependencies: []
    },
    {
      name: 'browser_extract',
      description: 'Extract content from page',
      tasks: [{ taskType: 'browser.extract', label: 'Extract page content', params: {}, maxRetries: 1 }],
      dependencies: ['browser_search']
    },
    {
      name: 'evidence_verify',
      description: 'Verify extracted data',
      tasks: [{ taskType: 'evidence.verify', label: 'Verify extraction', params: {}, maxRetries: 1 }],
      dependencies: ['browser_extract']
    },
    {
      name: 'memory_store',
      description: 'Store results in memory',
      tasks: [{ taskType: 'memory.store', label: 'Store evidence', params: {}, maxRetries: 1 }],
      dependencies: ['evidence_verify']
    },
    {
      name: 'mission_summary',
      description: 'Summarize results',
      tasks: [{ taskType: 'mission.summary', label: 'Create mission summary', params: {}, maxRetries: 1 }],
      dependencies: ['memory_store']
    }
  ],
  priority: 10
};

const DATA_COLLECTION: IntentTemplate = {
  name: 'data_collection',
  keywords: ['collect', 'gather', 'собери', 'compile', 'aggregate', 'summary', 'list'],
  phases: [
    {
      name: 'browser_navigate',
      description: 'Navigate to data source',
      tasks: [{ taskType: 'browser.navigate', label: 'Navigate to source', params: {}, maxRetries: 2 }],
      dependencies: []
    },
    {
      name: 'browser_extract',
      description: 'Extract data',
      tasks: [{ taskType: 'browser.extract', label: 'Extract data', params: {}, maxRetries: 2 }],
      dependencies: ['browser_navigate']
    },
    {
      name: 'memory_store',
      description: 'Store collected data',
      tasks: [{ taskType: 'memory.store', label: 'Persist data', params: {}, maxRetries: 1 }],
      dependencies: ['browser_extract']
    },
    {
      name: 'mission_summary',
      description: 'Summarize collection',
      tasks: [{ taskType: 'mission.summary', label: 'Collection report', params: {}, maxRetries: 1 }],
      dependencies: ['memory_store']
    }
  ],
  priority: 8
};

const VERIFICATION: IntentTemplate = {
  name: 'verification',
  keywords: ['verify', 'проверь', 'validate', 'confirm', 'ensure', 'is it true'],
  phases: [
    {
      name: 'browser_navigate',
      description: 'Navigate to target',
      tasks: [{ taskType: 'browser.navigate', label: 'Navigate to verify target', params: {}, maxRetries: 2 }],
      dependencies: []
    },
    {
      name: 'browser_extract',
      description: 'Extract current state',
      tasks: [{ taskType: 'browser.extract', label: 'Extract current state', params: {}, maxRetries: 1 }],
      dependencies: ['browser_navigate']
    },
    {
      name: 'evidence_verify',
      description: 'Verify condition',
      tasks: [{ taskType: 'evidence.verify', label: 'Verify condition', params: {}, maxRetries: 2 }],
      dependencies: ['browser_extract']
    },
    {
      name: 'mission_summary',
      description: 'Report verification result',
      tasks: [{ taskType: 'mission.summary', label: 'Verification report', params: {}, maxRetries: 1 }],
      dependencies: ['evidence_verify']
    }
  ],
  priority: 9
};

const MONITOR: IntentTemplate = {
  name: 'monitor',
  keywords: ['monitor', 'watch', 'следи', 'отслеживай', 'track', 'keep an eye'],
  phases: [
    {
      name: 'browser_navigate',
      description: 'Navigate to target',
      tasks: [{ taskType: 'browser.navigate', label: 'Navigate to monitored target', params: {}, maxRetries: 2 }],
      dependencies: []
    },
    {
      name: 'browser_extract',
      description: 'Extract current state',
      tasks: [{ taskType: 'browser.extract', label: 'Extract snapshot', params: {}, maxRetries: 2 }],
      dependencies: ['browser_navigate']
    },
    {
      name: 'evidence_record',
      description: 'Record state as evidence',
      tasks: [{ taskType: 'evidence.record', label: 'Record state evidence', params: {}, maxRetries: 1 }],
      dependencies: ['browser_extract']
    },
    {
      name: 'memory_store',
      description: 'Store in memory',
      tasks: [{ taskType: 'memory.store', label: 'Persist to memory', params: {}, maxRetries: 1 }],
      dependencies: ['evidence_record']
    }
  ],
  priority: 7
};

const GENERIC_BROWSER: IntentTemplate = {
  name: 'generic_browser',
  keywords: ['browser', 'web', 'page', 'site', 'url', 'http', 'website'],
  phases: [
    {
      name: 'browser_navigate',
      description: 'Navigate to URL',
      tasks: [{ taskType: 'browser.navigate', label: 'Open page', params: {}, maxRetries: 2 }],
      dependencies: []
    },
    {
      name: 'browser_extract',
      description: 'Extract page content',
      tasks: [{ taskType: 'browser.extract', label: 'Read page content', params: {}, maxRetries: 1 }],
      dependencies: ['browser_navigate']
    },
    {
      name: 'mission_summary',
      description: 'Summarize findings',
      tasks: [{ taskType: 'mission.summary', label: 'Create summary', params: {}, maxRetries: 1 }],
      dependencies: ['browser_extract']
    }
  ],
  priority: 5
};

const TEMPLATES: IntentTemplate[] = [
  WEB_RESEARCH,
  VERIFICATION,
  DATA_COLLECTION,
  MONITOR,
  GENERIC_BROWSER
];

export function registerTemplate(template: IntentTemplate): void {
  TEMPLATES.push(template);
  TEMPLATES.sort((a, b) => b.priority - a.priority);
}

export function analyzeIntent(input: string): { template: IntentTemplate; params: Record<string, unknown> } {
  const lower = input.toLowerCase();

  const matched = TEMPLATES.find(t =>
    t.keywords.some(kw => lower.includes(kw.toLowerCase()))
  );

  const template = matched ?? GENERIC_BROWSER;

  const params: Record<string, unknown> = {};
  const urlMatch = input.match(/(https?:\/\/[^\s,;)]+)/);
  if (urlMatch) params.url = urlMatch[1];

  const queryMatch = input.match(/(?:find|search|найди|ищи)\s+[""'"]([^""'"]+)[""']/i);
  if (queryMatch) params.searchQuery = queryMatch[1];

  return { template, params };
}

export function getTemplates(): IntentTemplate[] {
  return [...TEMPLATES];
}
