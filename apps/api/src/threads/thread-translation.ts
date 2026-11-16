import { BadGatewayException } from '@nestjs/common';
import type { ImportedThread } from './thread-parser';

async function translateText(text: string): Promise<string> {
  if (!text.trim()) return text;
  // Small chunks keep requests within the public translation endpoint's URL limits.
  const chunks: { text: string; separator: string }[] = [];
  let remaining = text;
  while (remaining.length > 1200) {
    const prefix = remaining.slice(0, 1200);
    const boundary = Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf(' '));
    let end = boundary > 600 ? boundary : 1200;
    // Never split an emoji's UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;
    const separator = remaining.slice(end).match(/^\s*/)?.[0] ?? '';
    chunks.push({ text: remaining.slice(0, end), separator });
    remaining = remaining.slice(end + separator.length);
  }
  if (remaining) chunks.push({ text: remaining, separator: '' });
  const translated: string[] = [];
  for (const chunk of chunks) {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    for (const [key, value] of Object.entries({ client: 'gtx', sl: 'auto', tl: 'pt', dt: 't', q: chunk.text })) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error('Translation unavailable');
    const data: unknown = await response.json();
    const segments = Array.isArray(data) ? data[0] : null;
    if (!Array.isArray(segments) || !segments.length ||
        segments.some((segment) => !Array.isArray(segment) || typeof segment[0] !== 'string')) {
      throw new Error('Invalid translation response');
    }
    translated.push(segments.map((segment: string[]) => segment[0]).join('') + chunk.separator);
  }
  return translated.join('');
}

export async function translateThread(thread: ImportedThread): Promise<ImportedThread> {
  try {
    const posts = thread.posts.map((post) => ({ ...post, originalText: post.text }));
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(3, posts.length) }, async () => {
      while (nextIndex < posts.length) {
        const index = nextIndex++;
        posts[index].text = await translateText(posts[index].originalText);
      }
    }));
    return { ...thread, title: posts[0].text.slice(0, 300), posts };
  } catch {
    throw new BadGatewayException('A thread foi reunida, mas a tradução para português falhou. Tente novamente.');
  }
}
