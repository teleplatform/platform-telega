import type { WebProvider, WebTransport } from './web-provider.types';

export function resolveWebTransport(provider: WebProvider): WebTransport {
  return 'cdp';
}

export function isWebProvider(provider: string): provider is WebProvider {
  return ['chatgpt_web', 'qwen_web', 'deepseek_web'].includes(provider as WebProvider);
}

export function getWebProviders(): WebProvider[] {
  return ['chatgpt_web', 'qwen_web', 'deepseek_web'];
}