import { hydrateWebProviderState } from './web-provider.state';

let bootstrapped = false;

export function bootstrapWebProviderRuntimeState(): void {
  if (bootstrapped) return;
  hydrateWebProviderState();
  bootstrapped = true;
}

export function isBootstrapped(): boolean {
  return bootstrapped;
}