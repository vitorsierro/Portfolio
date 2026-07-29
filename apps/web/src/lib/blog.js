const SERVER_API_URL = process.env.NEXT_PUBLIC_API_URL;

export const POSTS_PAGE_SIZE = 9;

const EMPTY_PAGE = { items: [], nextCursor: null };

/**
 * Mesma regra do lib/api.js: o site não pode depender da API para existir.
 *
 * /blog é pré-renderizado no build. Qualquer falha aqui derrubava a publicação
 * inteira — não só a API fora do ar, mas também a variável ausente, que é o
 * caso da CI: sem NEXT_PUBLIC_API_URL o template virava a string literal
 * "undefined/posts?limit=9" e o fetch estourava ERR_INVALID_URL antes mesmo de
 * chegar na rede, então o catch de erro de conexão não pegava.
 *
 * Com `revalidate: 60`, uma página vazia publicada durante uma janela de API
 * fora do ar se corrige sozinha no minuto seguinte. É bem melhor que não
 * conseguir publicar.
 *
 * Só server-side: o scroll infinito do BlogList faz o próprio fetch e já
 * mostra "tentar novamente" ao usuário — lá o erro deve aparecer, não sumir.
 */
export async function getPosts(cursor, limit = POSTS_PAGE_SIZE) {
  if (!SERVER_API_URL) {
    console.warn('[blog] NEXT_PUBLIC_API_URL não definida — listagem vazia');
    return EMPTY_PAGE;
  }

  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  try {
    const response = await fetch(
      `${SERVER_API_URL}/posts?${params.toString()}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      console.warn(`[blog] API respondeu ${response.status} — listagem vazia`);
      return EMPTY_PAGE;
    }

    return await response.json(); // { items, nextCursor }
  } catch (error) {
    console.warn(`[blog] API inacessível (${error.message}) — listagem vazia`);
    return EMPTY_PAGE;
  }
}

/**
 * Um post específico. Devolve null quando não existe.
 *
 * Aqui NÃO há fallback para falha de rede: /blog/post/[slug] é renderizado sob
 * demanda, então não bloqueia o build, e devolver null com a API fora do ar
 * transformaria uma indisponibilidade temporária num 404 — que o Next cacheia
 * e os buscadores tratam como "esse conteúdo não existe mais". Um 500 é a
 * resposta honesta e reversível.
 */
export async function getPost(slug) {
  if (!SERVER_API_URL) {
    return null;
  }

  const response = await fetch(
    `${SERVER_API_URL}/posts/${encodeURIComponent(slug)}`,
    { next: { revalidate: 300 } },
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch post: ${response.status}`);
  }

  return response.json();
}
