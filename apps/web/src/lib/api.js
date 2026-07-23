const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function getPortfolioData() {
  const response = await fetch(`${API_URL}/portfolio`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio data: ${response.status}`);
  }

  return response.json();
}
