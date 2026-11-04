import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { loadNight } from './digest/load.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = loadNight(config, night);
    if (!data) {
      return c.html(
        <Layout title={`digest ${night}`} lane={lane()}>
          <h1>digest {night}</h1>
          <p class="mute">no run log for this night</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={data} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = loadNight(config, night);
    if (result === null) return c.json({ error: 'no such night', night }, 404);
    return c.json(result);
  });

  return app;
}
