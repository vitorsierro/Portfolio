import { Controller, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { configureBodyParsers } from './body-parsers';

@Controller()
class PayloadController {
  @Post(['admin/threads', 'admin/threads/:id', 'other'])
  save(@Body() body: { posts: { text: string }[] }) {
    return { postCount: body.posts.length };
  }
}

describe('thread request size', () => {
  let app: NestExpressApplication;
  const payload = { posts: Array.from({ length: 10 }, () => ({ text: 'á'.repeat(10000) })) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [PayloadController] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureBodyParsers(app);
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('accepts a thread larger than 100 KB', async () => {
    await request(app.getHttpServer()).post('/admin/threads').send(payload)
      .expect(201).expect({ postCount: 10 });
  });
  it('keeps the smaller limit on unrelated endpoints', async () => {
    await request(app.getHttpServer()).post('/other').send(payload).expect(413);
  });
  it('rejects a thread exceeding 2 MB', async () => {
    await request(app.getHttpServer()).post('/admin/threads')
      .send({ posts: [{ text: 'a'.repeat(2 * 1024 * 1024) }] }).expect(413);
  });
});
