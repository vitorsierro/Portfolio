const SERVER_API_URL = process.env.API_URL || 'http://localhost:3001';

export const POSTS_PAGE_SIZE = 9;

// Server-side: first page of the public listing (feeds the infinite scroll).
export async function getPosts(cursor, limit = POSTS_PAGE_SIZE) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const response = await fetch(`${SERVER_API_URL}/posts?${params.toString()}`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`);
  }

  return response.json(); // { items, nextCursor }
}

// Server-side: a single published post by slug. Returns null on 404.
export async function getPost(slug) {
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
