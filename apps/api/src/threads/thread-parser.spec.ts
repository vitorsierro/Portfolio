import { normalizeThreadUrl, parseThreadHtml } from './thread-parser';

describe('normalizeThreadUrl', () => {
  it('converts an X post URL to the supported thread-reader URL', () => {
    expect(normalizeThreadUrl('https://x.com/author/status/2112184574721548387')).toEqual({
      readerUrl: 'https://twitter-thread.com/t/2112184574721548387',
      tweetId: '2112184574721548387',
      sourceUrl: 'https://x.com/author/status/2112184574721548387',
    });
  });

  it('rejects arbitrary hosts instead of fetching user-controlled URLs', () => {
    expect(() => normalizeThreadUrl('https://example.com/t/12345'))
      .toThrow('O link precisa ser um post do X ou uma thread do twitter-thread.com.');
  });

  it('rejects invalid usernames embedded in otherwise valid X links', () => {
    expect(() => normalizeThreadUrl('https://x.com/two.words/status/1234567890'))
      .toThrow('usuário válido');
  });
});

describe('parseThreadHtml', () => {
  it('extracts the opening post, continuation, author and allowed media', () => {
    const html = `
      <div id="thread-detail">
        <div>
          <div><h4><a title="Pessoa de Teste">Pessoa de Teste</a></h4><div>@teste</div></div>
          <div class="flex flex-col gap-8">
            <h1><div dir="auto" class="whitespace-pre-wrap text-lg">Primeiro post</div></h1>
            <div class="flex flex-col gap-6"><img src="https://pbs.twimg.com/media/foto.jpg" /></div>
            <div class="h-px border-0 border-transparent"></div>
            <div dir="auto" class="whitespace-pre-wrap text-lg">Segundo <a href="https://example.org">post</a>.</div>
          </div>
        </div>
      </div>`;

    expect(parseThreadHtml(html, normalizeThreadUrl('https://x.com/teste/status/2112184574721548387')))
      .toEqual({
        title: 'Primeiro post',
        sourceUrl: 'https://x.com/teste/status/2112184574721548387',
        authorName: 'Pessoa de Teste',
        authorHandle: '@teste',
        posts: [
          { text: 'Primeiro post', mediaUrls: ['https://pbs.twimg.com/media/foto.jpg'] },
          { text: 'Segundo post.', mediaUrls: [] },
        ],
      });
  });
});
