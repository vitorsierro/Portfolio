import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

export function configureBodyParsers(app: NestExpressApplication) {
  // Imported threads can exceed 100 KB even when each post is valid.
  app.use('/admin/threads', json({ limit: '2mb', inflate: false }));
  app.useBodyParser('json', { limit: '100kb', inflate: false });
  app.useBodyParser('urlencoded', { limit: '100kb', inflate: false, extended: false });
}
