export * from "./cdp.types.js";
export * from "./cdp.browser.js";
export * from "./cdp.session.js";
export * from "./cdp.health.js";
export * from "./cdp.registry.js";
export * from "./cdp.bridge.js";

import { getCDPBridge, createCDPBridge, type CDPBridge } from "./cdp.bridge.js";
import { getCDPBrowser, createCDPBrowser } from "./cdp.browser.js";
import { getCDPSessionManager, createCDPSessionManager } from "./cdp.session.js";
import { getCDPHealthMonitor, createCDPHealthMonitor } from "./cdp.health.js";
import { getCDPProviderRegistry, createCDPProviderRegistry } from "./cdp.registry.js";

export const webCDP = {
  getBridge: getCDPBridge,
  createBridge: createCDPBridge,
  getBrowser: getCDPBrowser,
  createBrowser: createCDPBrowser,
  getSessionManager: getCDPSessionManager,
  createSessionManager: createCDPSessionManager,
  getHealthMonitor: getCDPHealthMonitor,
  createHealthMonitor: createCDPHealthMonitor,
  getRegistry: getCDPProviderRegistry,
  createRegistry: createCDPProviderRegistry,
};

export type { CDPBridge };