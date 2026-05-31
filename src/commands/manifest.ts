import type { AgentContext } from '../agent/context.js';
import { MANIFEST } from '../agent/manifest.js';

export async function runManifest(ctx: AgentContext): Promise<void> {
  ctx.ok('manifest', MANIFEST, () => {
    process.stdout.write(`${JSON.stringify(MANIFEST, null, 2)}\n`);
  });
}
