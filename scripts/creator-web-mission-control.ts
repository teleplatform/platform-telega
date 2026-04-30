import { bootstrapWebProviderRuntimeState } from '../src/providers/web/index.js';
import { executeMissionControlCommand } from '../src/providers/web/web-provider.command-mode.js';

function parseArgs(): {
  action?: 'reset' | 'disable' | 'enable' | 'rehab_set' | 'clear_cooldown';
  provider?: 'openai_web' | 'qwen_web' | 'deepseek_web';
  reason?: string;
  rehabStage?: 'probation' | 'recovery' | 'restored';
  json?: boolean;
  policy?: 'safe' | 'balanced' | 'aggressive_recovery';
  policyHint?: boolean;
  policyApplyHint?: boolean;
  policyForce?: 'safe' | 'balanced' | 'aggressive_recovery';
  policyRevert?: boolean;
  incidentForce?: 'normal' | 'degraded' | 'incident';
  incidentClear?: boolean;
} {
  const args = process.argv.slice(2);
  const result: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--json') {
      result.json = true;
    } else if (arg === '--audit' && args[i + 1]) {
      result.auditLimit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--policy' && args[i + 1]) {
      const policyArg = args[i + 1];
      if (policyArg === 'set' && args[i + 2]) {
        result.policy = args[i + 2];
        i += 2;
      } else if (policyArg === 'list') {
        result.policyList = true;
        i++;
      } else if (['safe', 'balanced', 'aggressive_recovery'].includes(policyArg)) {
        result.policy = policyArg;
        i++;
      }
    } else if (arg === '--disable' && args[i + 1]) {
      result.action = 'disable';
      result.provider = args[i + 1];
      i++;
    } else if (arg === '--enable' && args[i + 1]) {
      result.action = 'enable';
      result.provider = args[i + 1];
      i++;
    } else if (arg === '--reset' && args[i + 1]) {
      result.action = 'reset';
      result.provider = args[i + 1];
      i++;
    } else if (arg === '--rehab-set' && args[i + 1] && args[i + 2]) {
      result.action = 'rehab_set';
      result.provider = args[i + 1];
      result.rehabStage = args[i + 2];
      i += 2;
    } else if (arg === '--clear-cooldown' && args[i + 1]) {
      result.action = 'clear_cooldown';
      result.provider = args[i + 1];
      i++;
    } else if (arg === '--reason' && args[i + 1]) {
      result.reason = args[i + 1];
      i++;
    } else if (arg === '--policy-hint') {
      result.policyHint = true;
    } else if (arg === '--policy-apply-hint') {
      result.policyApplyHint = true;
    } else if (arg === '--policy-force' && args[i + 1]) {
      const forcePolicy = args[i + 1];
      if (['safe', 'balanced', 'aggressive_recovery'].includes(forcePolicy)) {
        result.policyForce = forcePolicy;
        i++;
      }
    } else if (arg === '--policy-revert') {
      result.policyRevert = true;
    } else if (arg === '--incident-force' && args[i + 1]) {
      const forceIncident = args[i + 1];
      if (['normal', 'degraded', 'incident'].includes(forceIncident)) {
        result.incidentForce = forceIncident;
        i++;
      }
    } else if (arg === '--incident-clear') {
      result.incidentClear = true;
    }
  }

  if (result.provider && !['openai_web', 'qwen_web', 'deepseek_web'].includes(result.provider)) {
    console.error('Invalid provider. Use: openai_web, qwen_web, deepseek_web');
    process.exit(1);
  }

  if (result.rehabStage && !['probation', 'recovery', 'restored'].includes(result.rehabStage)) {
    console.error('Invalid rehab stage. Use: probation, recovery, restored');
    process.exit(1);
  }

  if (result.policy && !['safe', 'balanced', 'aggressive_recovery'].includes(result.policy)) {
    console.error('Invalid policy. Use: safe, balanced, aggressive_recovery');
    process.exit(1);
  }

  return result;
}

async function main() {
  bootstrapWebProviderRuntimeState();

  const input = parseArgs();
  console.log('DEBUG: parsed input =', JSON.stringify(input, null, 2));
  const result = await executeMissionControlCommand(input);

  if (!result.ok && result.error) {
    console.error('Error:', result.error);
    process.exit(1);
  }

  if (input.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('═══════════════════════════════════════════');
  console.log('     CREATOR WEB MISSION CONTROL');
  console.log('═══════════════════════════════════════════\n');

  if (result.mode === 'action') {
    console.log(`Action executed: ${result.action} ${result.provider}`);
    console.log('');
  }

  if (result.mode === 'incident') {
    if (result.incidentChanged) {
      console.log(`Incident mode forced: ${result.missionControlSnapshot.runtimeMode}`);
    }
    if (result.incidentCleared) {
      console.log('Incident mode cleared');
    }
    console.log('');
  }

  const view = result.missionControlSnapshot;

  const modeIndicator = view.runtimeMode === 'normal' ? '' : view.runtimeMode === 'degraded' ? '⚠️ DEGRADED' : '🚨 INCIDENT';
  console.log(`Active Policy: ${view.activePolicy} ${modeIndicator}`.trim());

  if (view.policyGovernor) {
    const g = view.policyGovernor;
    console.log(`Policy Governor: switchAllowed=${g.switchAllowed}, cooldown=${g.cooldownRemainingMs > 0 ? Math.round(g.cooldownRemainingMs / 60000) + 'min' : 'none'}`);
  }

  if (view.policyHint) {
    console.log(`Recommended: ${view.policyHint.recommended} (${view.policyHint.confidence} confidence)`);
  }
  console.log('');

  console.log('Providers:');
  console.log('─────────────────────────────────────────');
  for (const p of view.providers) {
    const status = !p.enabled ? '🚫 DISABLED' : !p.ready ? '⚪ NOT READY' : '🟢 READY';
    const cooldownStr = p.cooldownRemainingMs ? `cooldown=${Math.round(p.cooldownRemainingMs / 1000)}s` : 'cooldown=none';
    const streak = `${p.consecutiveSuccesses}↑/${p.consecutiveFailures}↓`;
    const lastFail = p.lastFailureReason ? `, lastFail=${p.lastFailureReason}` : '';
    const latency = p.lastLatencyMs ? `, lat=${p.lastLatencyMs}ms` : '';
    
    console.log(`${p.provider.padEnd(15)} score=${String(p.score).padStart(3)} ${status}`);
    console.log(`                     ${cooldownStr}, rehab=${p.rehabStage}, streak=${streak}${lastFail}${latency}`);
    console.log('');
  }

  console.log('Selected Order:');
  console.log('─────────────────────────────────────────');
  for (let i = 0; i < view.selectedOrder.length; i++) {
    console.log(`  ${i + 1}. ${view.selectedOrder[i]}`);
  }
  console.log('');

  if (result.auditTail && result.auditTail.length > 0) {
    console.log('Recent Audit:');
    console.log('─────────────────────────────────────────');
    for (const event of result.auditTail.slice(0, 10)) {
      const ts = new Date(event.ts).toLocaleTimeString();
      console.log(`  [${ts}] ${event.action} ${event.provider}${event.reason ? ` (${event.reason})` : ''}`);
    }
    console.log('');
  }

  console.log(`Generated: ${new Date(view.generatedAt).toISOString()}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});