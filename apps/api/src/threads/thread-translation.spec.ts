import { translateThread } from './thread-translation';

const thread = {
  title: 'Hello', sourceUrl: 'https://x.com/test/status/123',
  authorName: 'Test', authorHandle: '@test',
  posts: [{ text: 'Hello', mediaUrls: ['https://pbs.twimg.com/media/test.jpg'] }, { text: 'World', mediaUrls: [] }],
};

describe('thread translation', () => {
  afterEach(() => jest.restoreAllMocks());
  it('translates every post, preserving its original, order and media', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([[['Olá', 'Hello']]])))
      .mockResolvedValueOnce(new Response(JSON.stringify([[['Mundo', 'World']]])));
    const translated = await translateThread(thread);
    expect(translated.title).toBe('Olá');
    expect(translated.posts).toEqual([
      { text: 'Olá', originalText: 'Hello', mediaUrls: thread.posts[0].mediaUrls },
      { text: 'Mundo', originalText: 'World', mediaUrls: [] },
    ]);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('tl')).toBe('pt');
  });
  it('reports translation failure instead of returning an untranslated success', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('Unavailable', { status: 503 }));
    await expect(translateThread(thread)).rejects.toThrow('tradução para português falhou');
  });
  it('preserves all text and separators when splitting a long post', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const text = new URL(String(input)).searchParams.get('q');
      return new Response(JSON.stringify([[[text, text]]]));
    });
    const text = 'A long paragraph 😀. '.repeat(200);
    const result = await translateThread({ ...thread, posts: [{ text, mediaUrls: [] }] });
    expect(result.posts[0].text).toBe(text);
    expect(result.posts[0].originalText).toBe(text);
  });
});
