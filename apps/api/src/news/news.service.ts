import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { parseNewsHtml } from './news-parser';

const HOSTS = new Set(['uol.com.br', 'www.uol.com.br', 'noticias.uol.com.br', 'economia.uol.com.br',
  'www1.folha.uol.com.br', 'g1.globo.com', 'ge.globo.com', 'oglobo.globo.com', 'valor.globo.com',
  'www.estadao.com.br', 'www.cnnbrasil.com.br', 'www.bbc.com', 'www.bbc.co.uk']);
const MAX_BYTES = 4 * 1024 * 1024;
export function newsUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new BadRequestException('Informe um link válido.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !HOSTS.has(url.hostname)) {
    throw new BadRequestException('Use um link HTTPS de UOL, Folha, Globo, Estadão, CNN Brasil ou BBC.');
  }
  url.hash = '';
  return url;
}

@Injectable()
export class NewsService {
  async importArticle(sourceUrl: string) {
    let url = newsUrl(sourceUrl);
    for (let hop = 0; hop < 4; hop += 1) {
      let response: Response;
      try {
        response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000),
          headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioNewsReader/1.0)' } });
      } catch { throw new BadGatewayException('Não foi possível acessar o site da notícia.'); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new BadGatewayException('O site retornou um redirecionamento inválido.');
        url = newsUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new BadGatewayException('O site não disponibilizou essa notícia para leitura.'); }
      if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') ?? '')) {
        await response.body?.cancel(); throw new BadGatewayException('O link não retornou uma página de notícia.');
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body?.cancel(); throw new BadGatewayException('A página excede o limite de tamanho.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new BadGatewayException('A página retornou vazia.');
      const decoder = new TextDecoder(); let html = ''; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) throw new Error('A página excede o limite de tamanho.');
          html += decoder.decode(value, { stream: true });
        }
        html += decoder.decode();
      } catch {
        await reader.cancel().catch(() => undefined);
        throw new BadGatewayException('Não foi possível ler a página dentro do limite permitido.');
      }
      try { return parseNewsHtml(html, url.toString()); }
      catch (error) { throw new BadGatewayException(error instanceof Error ? error.message : 'Texto da notícia indisponível.'); }
    }
    throw new BadGatewayException('O site redirecionou a leitura muitas vezes.');
  }
}
