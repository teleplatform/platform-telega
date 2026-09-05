export interface CreatorBrowserSession {
  session_id: string;
  open(url: string): Promise<void>;
  waitForReady(selectors: string[], timeoutMs: number): Promise<void>;
  click(selectors: string[]): Promise<void>;
  type(selectors: string[], text: string): Promise<void>;
  read(selectors: string[]): Promise<string>;
  screenshot(label: string): Promise<string>;
  snapshotHtml(label: string): Promise<string>;
  isVisible(selectors: string[]): Promise<boolean>;
}

export class NoopBrowserSession implements CreatorBrowserSession {
  session_id = "noop-session";

  async open(_url: string): Promise<void> {}
  async waitForReady(_selectors: string[], _timeoutMs: number): Promise<void> {}
  async click(_selectors: string[]): Promise<void> {}
  async type(_selectors: string[], _text: string): Promise<void> {}
  async read(_selectors: string[]): Promise<string> { return ""; }
  async screenshot(_label: string): Promise<string> { return ""; }
  async snapshotHtml(_label: string): Promise<string> { return ""; }
  async isVisible(_selectors: string[]): Promise<boolean> { return false; }
}
