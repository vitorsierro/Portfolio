import { Test } from '@nestjs/testing';
import { ThreadsModule } from './threads.module';

describe('ThreadsModule', () => {
  it('resolves controller guards and service dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThreadsModule],
    }).compile();

    await moduleRef.close();
  });
});
