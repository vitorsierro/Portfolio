import { readingType, newsReading, readingPayload } from './readings';

test.each(['https://x.com/test/status/100', 'https://www.twitter.com/test/status/100', 'https://twitter-thread.com/t/100'])('detects supported thread links: %s', (url) => {
  expect(readingType(url)).toBe('thread');
});
test('news classification does not mistake a similar hostname for X', () => {
  expect(readingType('https://x.com.evil.com/test')).toBe('news');
});
test('long news text survives grouping and save payload creation intact', () => {
  const paragraphs = ['Parágrafo 😀 '.repeat(3000), 'Outro parágrafo.'];
  const reading = newsReading({ title: 'Teste', sourceUrl: 'https://www.uol.com.br/test.htm', paragraphs, restricted: true });
  const payload = readingPayload(reading);
  expect(payload.posts.length).toBeGreaterThan(1);
  expect(payload.posts.every((post) => post.text.length <= 30000)).toBe(true);
  expect(payload.posts.map((post) => post.text).join('')).toBe(paragraphs.join('\n\n'));
  expect(payload).not.toHaveProperty('restricted');
});
