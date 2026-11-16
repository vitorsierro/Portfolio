import { parseDocument } from 'htmlparser2';

type Node = { name?: string; type?: string; data?: string; attribs?: Record<string, string>; children?: Node[] };
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => value && typeof value === 'object' ? value as Obj : {};
function all(node: Node): Node[] { return [node, ...(node.children ?? []).flatMap(all)]; }
function text(node: Node): string {
  if (node.type === 'text') return node.data ?? '';
  if (node.name === 'br') return '\n';
  if (['script', 'style', 'nav', 'aside', 'footer', 'button', 'form'].includes(node.name ?? '')) return '';
  if (/(?:^|[\s_-])(advertisement|related|newsletter|comments|share|paywall)(?:$|[\s_-])/i.test(node.attribs?.class ?? '')) return '';
  return (node.children ?? []).map(text).join('');
}
function articleParagraphs(node: Node): string[] {
  if (['script', 'style', 'nav', 'aside', 'footer', 'button', 'form'].includes(node.name ?? '') ||
      /(?:^|[\s_-])(advertisement|related|newsletter|comments|share|paywall)(?:$|[\s_-])/i.test(node.attribs?.class ?? '')) return [];
  if (['p', 'h2', 'h3', 'blockquote'].includes(node.name ?? '')) {
    const value = clean(text(node));
    return value ? [value] : [];
  }
  return (node.children ?? []).flatMap(articleParagraphs);
}
const clean = (value: string) => value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
function plain(value: string): string {
  return clean(text(parseDocument(value) as unknown as Node));
}

export interface NewsArticle {
  title: string;
  sourceUrl: string;
  author: string;
  publishedAt: string;
  paragraphs: string[];
  restricted: boolean;
}

export function parseNewsHtml(html: string, sourceUrl: string): NewsArticle {
  const nodes = all(parseDocument(html) as unknown as Node);
  const meta = (key: string) => nodes.find((node) => node.name === 'meta' &&
    (node.attribs?.property === key || node.attribs?.name === key))?.attribs?.content ?? '';
  let title = meta('og:title') || clean(text(nodes.find((node) => node.name === 'h1') ?? {}));
  let author = meta('author');
  let publishedAt = meta('article:published_time');
  let restricted = false;
  let paragraphs: string[] = [];

  // UOL's hydration data contains article fragments without navigation or overlays.
  const stateNode = nodes.find((node) => node.attribs?.id === 'VUELAND_STATE');
  if (stateNode) {
    try {
      const state = object(JSON.parse((stateNode.children ?? []).map((node) => node.data ?? '').join('')));
      const page = object(state.page);
      const chunks = object(state.news).contentChunks;
      title = typeof page.title === 'string' ? plain(page.title) : title;
      restricted = page.isPrime === true;
      publishedAt = typeof page.created === 'string' ? page.created : publishedAt;
      if (Array.isArray(page.authors)) author = page.authors.map((item) => object(item).name).filter((value) => typeof value === 'string').join(', ');
      if (Array.isArray(chunks)) for (const group of chunks) {
        if (!Array.isArray(group)) continue;
        for (const fragment of group) {
          const item = object(fragment);
          if (['p', 'h2', 'h3', 'blockquote', 'li'].includes(String(item.tag)) && typeof item.content === 'string') {
            const value = plain(item.content);
            if (value) paragraphs.push(value);
          }
        }
      }
    } catch { /* Fall back to structured metadata or article HTML. */ }
  }
  function visitSchema(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visitSchema); return; }
    const schema = object(value);
    const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
    if (types.some((type) => ['NewsArticle', 'Article', 'ReportageNewsArticle', 'BlogPosting'].includes(String(type)))) {
      if (schema.isAccessibleForFree === false || schema.isAccessibleForFree === 'False') restricted = true;
      if (!title && typeof schema.headline === 'string') title = plain(schema.headline);
      if (!publishedAt && typeof schema.datePublished === 'string') publishedAt = schema.datePublished;
      if (!author) {
        const authors = Array.isArray(schema.author) ? schema.author : [schema.author];
        author = authors.map((item) => typeof item === 'string' ? item : object(item).name).filter((item) => typeof item === 'string').join(', ');
      }
      if (!paragraphs.length && typeof schema.articleBody === 'string') {
        paragraphs = schema.articleBody.split(/\n+/).map(plain).filter(Boolean);
      }
    }
    if (schema['@graph']) visitSchema(schema['@graph']);
  }
  for (const node of nodes.filter((node) => node.attribs?.type === 'application/ld+json')) {
    try { visitSchema(JSON.parse((node.children ?? []).map((child) => child.data ?? '').join(''))); } catch { /* Invalid metadata is not article text. */ }
  }
  if (!paragraphs.length) {
    const candidates = nodes.filter((node) => node.attribs?.itemprop === 'articleBody' || node.name === 'article' ||
      /(?:^|\s)(?:materia-conteudo|c-news__body|article-body|content-text)(?:\s|$)/.test(node.attribs?.class ?? ''));
    const extracted = candidates.map(articleParagraphs);
    paragraphs = extracted.sort((a, b) => b.join('').length - a.join('').length)[0] ?? [];
  }
  if (!title || !paragraphs.length) throw new Error('O site não disponibilizou o texto da matéria. Conteúdo que exige login ou assinatura pode não estar presente.');
  return { title, sourceUrl, author, publishedAt, restricted, paragraphs };
}
