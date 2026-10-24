import { fileURLToPath } from 'node:url';
import { loadConfig, PROVIDER_MODULES } from './providers';
import { buildApp } from './core/app';
import { Store } from './core/db';
import { runRetention } from './core/retention';

const config = loadConfig();
const store = new Store(config.databaseUrl);
store.migrate();

const frontendDist = fileURLToPath(new URL('../frontend/dist', import.meta.url));
const { app, services } = await buildApp({ config, store, modules: PROVIDER_MODULES, frontendDist });

runRetention(services, config, app.log);
const retentionTimer = setInterval(
  () => runRetention(services, config, app.log),
  24 * 60 * 60 * 1000
);
retentionTimer.unref();

await app.listen({ port: config.port, host: '0.0.0.0' });

function shutdown(): void {
  clearInterval(retentionTimer);
  void app.close().then(() => store.close());
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
