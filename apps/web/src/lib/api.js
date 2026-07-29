import fallback from '../content/portfolio-fallback.json';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Dados do portfólio.
 *
 * Lançar quando a API não responde derruba o BUILD inteiro: a home é
 * pré-renderizada, então uma API fora do ar no momento do deploy — ou
 * simplesmente ausente, como na CI — impedia o site de ser publicado. O site
 * não pode depender da API para existir.
 *
 * O fallback é uma cópia de apps/api/src/data/dados.json. Ele fica levemente
 * defasado se o original mudar, o que é um preço pequeno perto de não
 * conseguir publicar.
 */
export async function getPortfolioData() {
  try {
    const response = await fetch(`${API_URL}/portfolio`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.warn(
        `[portfolio] API respondeu ${response.status} — usando fallback`,
      );
      return fallback;
    }

    return await response.json();
  } catch (error) {
    console.warn(
      `[portfolio] API inacessível (${error.message}) — usando fallback`,
    );
    return fallback;
  }
}
