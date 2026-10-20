import { parseDocument } from 'htmlparser2';

export interface NormalizedThreadUrl {
  readerUrl: string;
  sourceUrl: string;
  tweetId: string;
}

const POST_PATH = /^\/([^/]+)\/status\/(\d+)(?:\/.*)?\/?$/;
const READER_PATH = /^\/t\/(\d+)\/?$/;

export function normalizeThreadUrl(input: string): NormalizedThreadUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Cole um link válido de X ou twitter-thread.com.');
  }

  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Cole um link válido de X ou twitter-thread.com.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const readerMatch = host === 'twitter-thread.com' && url.pathname.match(READER_PATH);
  const postMatch = ['x.com', 'twitter.com'].includes(host) && url.pathname.match(POST_PATH);

  if (readerMatch) {
    const tweetId = readerMatch[1];
    const readerUrl = `https://twitter-thread.com/t/${tweetId}`;
    return { readerUrl, sourceUrl: readerUrl, tweetId };
  }

  if (postMatch) {
    const [, handle, tweetId] = postMatch;
    if (handle !== 'i' && !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
      throw new Error('O link precisa conter um usuário válido do X.');
    }
    const sourceUrl = `https://x.com/${handle}/status/${tweetId}`;
    return {
      readerUrl: `https://twitter-thread.com/t/${tweetId}`,
      sourceUrl,
      tweetId,
    };
  }

  throw new Error('O link precisa ser um post do X ou uma thread do twitter-thread.com.');
}

export interface ThreadPost {
  text: string;
  mediaUrls: string[];
}

export interface ImportedThread {
  title: string;
  sourceUrl: string;
  authorName: string;
  authorHandle: string;
  posts: ThreadPost[];
}

type HtmlNode = {
  type?: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
};

function descendants(node: HtmlNode): HtmlNode[] {
  const result: HtmlNode[] = [];
  for (const child of node.children ?? []) {
    result.push(child, ...descendants(child));
  }
  return result;
}

function textContent(node: HtmlNode): string {
  if (node.type === 'text') return node.data ?? '';
  if (node.name === 'br') return '\n';
  return (node.children ?? []).map(textContent).join('');
}

function cleanText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
}

function hasClass(node: HtmlNode, name: string): boolean {
  return (node.attribs?.class ?? '').split(/\s+/).includes(name);
}

function isTweetText(node: HtmlNode): boolean {
  return (
    node.type === 'tag' &&
    node.name === 'div' &&
    node.attribs?.dir === 'auto' &&
    hasClass(node, 'whitespace-pre-wrap') &&
    hasClass(node, 'text-lg')
  );
}

function safeMediaUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'pbs.twimg.com'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function parseThreadHtml(
  html: string,
  normalized: NormalizedThreadUrl,
): ImportedThread {
  const document = parseDocument(html);
  const root = descendants(document as unknown as HtmlNode).find(
    (node) => node.attribs?.id === 'thread-detail',
  );
  if (!root) throw new Error('A página não contém uma thread reconhecível.');

  const panel = descendants(root).find(
    (node) =>
      node.type === 'tag' &&
      node.name === 'div' &&
      hasClass(node, 'flex') &&
      descendants(node).some((child) => child.name === 'h1'),
  );
  if (!panel) throw new Error('Não foi possível localizar os posts da thread.');

  const posts: ThreadPost[] = [];
  for (const child of panel.children ?? []) {
    if (child.type === 'tag' && child.name === 'h1') {
      const text = cleanText(textContent(child));
      if (text) posts.push({ text, mediaUrls: [] });
      continue;
    }
    if (isTweetText(child)) {
      const text = cleanText(textContent(child));
      if (text) posts.push({ text, mediaUrls: [] });
      continue;
    }
    const currentPost = posts.at(-1);
    if (!currentPost) continue;
    for (const image of descendants(child).filter((node) => node.name === 'img')) {
      const mediaUrl = safeMediaUrl(image.attribs?.src);
      if (mediaUrl && !currentPost.mediaUrls.includes(mediaUrl)) {
        currentPost.mediaUrls.push(mediaUrl);
      }
    }
  }

  if (!posts.length) throw new Error('A thread não possui posts legíveis.');
  if (posts.length > 100) throw new Error('A thread excede o limite de 100 posts.');

  const nodes = descendants(root);
  const authorHeading = nodes.find((node) => node.name === 'h4');
  const authorLink = authorHeading
    ? descendants(authorHeading).find((node) => node.name === 'a')
    : undefined;
  const authorName = cleanText(
    authorLink?.attribs?.title ?? (authorLink ? textContent(authorLink) : ''),
  );
  const handleMatch = cleanText(textContent(root)).match(/@[A-Za-z0-9_]{1,15}/);
  const authorHandle = handleMatch?.[0] ?? '';
  const handle = authorHandle.slice(1);
  const sourceUrl = normalized.sourceUrl.startsWith('https://twitter-thread.com/') && handle
    ? `https://x.com/${handle}/status/${normalized.tweetId}`
    : normalized.sourceUrl;

  return {
    title: posts[0].text.slice(0, 500),
    sourceUrl,
    authorName: authorName.slice(0, 200),
    authorHandle,
    posts,
  };
}
