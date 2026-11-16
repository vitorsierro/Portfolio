export function readingType(sourceUrl) {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
    return ['x.com', 'twitter.com', 'twitter-thread.com'].includes(host) ? 'thread' : 'news';
  } catch { return 'news'; }
}

export function newsReading(article) {
  // Group paragraphs into saveable blocks without dropping article text.
  const text = article.paragraphs.join('\n\n');
  const posts = [];
  let remaining = text;
  while (remaining) {
    let end = Math.min(20000, remaining.length);
    if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;
    posts.push({ text: remaining.slice(0, end), mediaUrls: [] });
    remaining = remaining.slice(end);
  }
  if (!posts.length || posts.length > 100) throw new Error('A notícia excede o tamanho permitido para a biblioteca.');
  return {
    title: article.title, sourceUrl: article.sourceUrl, authorName: (article.author || '').slice(0, 200),
    authorHandle: '', posts, restricted: article.restricted,
  };
}

export function readingPayload(reading) {
  const { title, sourceUrl, authorName, authorHandle, posts } = reading;
  return { title, sourceUrl, authorName, authorHandle, posts };
}
