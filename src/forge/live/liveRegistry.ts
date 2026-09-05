import { LiveEvent, LiveAlert } from "./liveTypes";

const events: LiveEvent[] = [];
const alerts: LiveAlert[] = [];
const MAX_EVENTS = 200;
const MAX_ALERTS = 50;

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export const LiveRegistry = {
  appendEvent(
    kind: string,
    source: string,
    summary: string,
    details: Record<string, unknown>,
    severity: LiveEvent["severity"] = "info"
  ): LiveEvent {
    const event: LiveEvent = {
      id: genId("evt"),
      timestamp: new Date().toISOString(),
      kind,
      source,
      summary,
      details,
      severity,
    };
    events.push(event);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    return event;
  },

  appendAlert(kind: string, message: string, severity: LiveAlert["severity"]): LiveAlert {
    const alert: LiveAlert = {
      id: genId("alt"),
      timestamp: new Date().toISOString(),
      kind,
      message,
      severity,
      acknowledged: false,
    };
    alerts.push(alert);
    if (alerts.length > MAX_ALERTS) alerts.splice(0, alerts.length - MAX_ALERTS);
    return alert;
  },

  getFeed(limit = 50): LiveEvent[] {
    return events.slice(-limit).reverse();
  },

  getAlerts(limit = 20): LiveAlert[] {
    return alerts.slice(-limit).reverse();
  },

  acknowledgeAlert(alertId: string): boolean {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  },

  getUnacknowledgedAlerts(): LiveAlert[] {
    return alerts.filter((a) => !a.acknowledged);
  },

  clear(): void {
    events.length = 0;
    alerts.length = 0;
  },
};
