import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateThreadDto, UpdateThreadDto } from './threads.dto';

const validPost = { text: 'Post', mediaUrls: [] };
const validSourceUrl = 'https://x.com/teste/status/2112184574721548387';

function hasTitleError(errors: Awaited<ReturnType<typeof validate>>) {
  return errors.some((error) => error.property === 'title');
}

describe('thread title validation', () => {
  it('accepts a news article in the shared reading library', async () => {
    const dto = plainToInstance(CreateThreadDto, {
      title: 'Notícia salva', sourceUrl: 'https://www.uol.com.br/esporte/teste.htm',
      authorName: 'Autora', authorHandle: '', posts: [validPost],
    });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });
  it('rejects unsafe protocols when saving a reading', async () => {
    const dto = plainToInstance(CreateThreadDto, {
      title: 'Notícia', sourceUrl: 'javascript:alert(1)', posts: [validPost],
    });
    expect((await validate(dto)).some((error) => error.property === 'sourceUrl')).toBe(true);
  });
  it('rejects a create title that becomes empty after trimming', async () => {
    const dto = plainToInstance(CreateThreadDto, {
      title: '   ', sourceUrl: validSourceUrl, posts: [validPost],
    });

    expect(hasTitleError(await validate(dto))).toBe(true);
  });

  it('rejects an update title that becomes empty after trimming', async () => {
    const dto = plainToInstance(UpdateThreadDto, { title: '   ' });

    expect(hasTitleError(await validate(dto))).toBe(true);
  });
});
