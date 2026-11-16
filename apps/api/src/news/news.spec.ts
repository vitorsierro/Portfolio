import { Test } from '@nestjs/testing';
import { NewsModule } from './news.module';
import { parseNewsHtml } from './news-parser';
import { NewsService, newsUrl } from './news.service';

const url = 'https://www.uol.com.br/noticia.htm';
const state = { page: { title: 'Matéria de teste', isPrime: true, authors: [{ name: 'Autora' }] },
  news: { contentChunks: [[{ tag: 'p', content: 'Primeiro <strong>parágrafo</strong>.' }], [{ tag: 'p', content: 'Continuação.' }]] } };
const html = `<script id="VUELAND_STATE" type="application/json">${JSON.stringify(state)}</script><aside>Assine</aside>`;

describe('news reader', () => {
  afterEach(() => jest.restoreAllMocks());
  it('extracts all UOL chunks in order and strips markup without including the overlay', () => {
    expect(parseNewsHtml(html, url)).toMatchObject({ title: 'Matéria de teste', author: 'Autora', restricted: true,
      paragraphs: ['Primeiro parágrafo.', 'Continuação.'] });
  });
  it('extracts structured article data and detects restricted access', () => {
    const schema = { '@graph': [{ '@type': 'NewsArticle', headline: 'Teste', isAccessibleForFree: false,
      articleBody: 'Primeiro\nSegundo', author: { name: 'Autor' } }] };
    expect(parseNewsHtml(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`, url))
      .toMatchObject({ title: 'Teste', paragraphs: ['Primeiro', 'Segundo'], restricted: true });
  });
  it('omits navigation, recommendations and scripts from article HTML', () => {
    expect(parseNewsHtml('<h1>Teste</h1><article><p>Texto.</p><aside><p>Outro artigo</p></aside><div class="related"><p>Recomendação</p></div><script>alert(1)</script><p>Final.</p></article>', url).paragraphs)
      .toEqual(['Texto.', 'Final.']);
  });
  it('does not represent a subscription overlay as an article', () => {
    expect(() => parseNewsHtml('<h1>Teste</h1><div class="paywall"><p>Assine para ler</p></div>', url)).toThrow('não disponibilizou');
  });
  it.each(['https://127.0.0.1', 'https://www.uol.com.br.evil.com/test', 'https://www.uol.com.br:8443', 'https://me@www.uol.com.br', 'http://www.uol.com.br'])('rejects unsupported targets: %s', (value) => {
    expect(() => newsUrl(value)).toThrow();
  });
  it('fetches HTML with redirects disabled', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(html, { headers: { 'content-type': 'text/html' } }));
    expect((await new NewsService().importArticle(url)).paragraphs).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual' }));
  });
  it('refuses a redirect to a private service before making another request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    await expect(new NewsService().importArticle(url)).rejects.toThrow('HTTPS');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('cancels a page exceeding the byte limit', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); }, cancel });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }));
    await expect(new NewsService().importArticle(url)).rejects.toThrow('limite');
    expect(cancel).toHaveBeenCalled();
  });
  it('resolves authenticated module dependencies', async () => {
    const module = await Test.createTestingModule({ imports: [NewsModule] }).compile();
    await module.close();
  });
});
