import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SavedThread } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeThreadUrl, parseThreadHtml } from './thread-parser';
import type { ImportedThread, ThreadPost } from './thread-parser';
import type { CreateThreadDto, ThreadPostDto, UpdateThreadDto } from './dto/threads.dto';

const MAX_READER_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMPORTED_POSTS = 100;

async function readReaderHtml(response: Response): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let html = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_READER_HTML_BYTES) {
        await reader.cancel();
        throw new BadGatewayException('A página da thread excede o limite de tamanho permitido.');
      }
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } catch (error) {
    if (error instanceof BadGatewayException) throw error;
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed or errored.
    }
    throw new BadGatewayException('Não foi possível ler a página da thread.');
  }
}

export interface SavedThreadDetail {
  id: string;
  title: string;
  sourceUrl: string;
  authorName: string;
  authorHandle: string;
  posts: ThreadPost[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedThreadSummary extends Omit<SavedThreadDetail, 'posts'> {
  postCount: number;
  preview: string;
}

@Injectable()
export class ThreadsService {
  constructor(private readonly prisma: PrismaService) {}

  async importThread(sourceUrl: string): Promise<ImportedThread> {
    let normalized;
    try {
      normalized = normalizeThreadUrl(sourceUrl);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Link inválido.');
    }

    let response: Response;
    try {
      response = await fetch(normalized.readerUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; PortfolioThreadReader/1.0)',
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new BadGatewayException('Não foi possível acessar o leitor público de threads. Tente novamente mais tarde.');
    }

    if (!response.ok) {
      throw new BadGatewayException(`O leitor público de threads respondeu com status ${response.status}.`);
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_READER_HTML_BYTES) {
      throw new BadGatewayException('A página da thread excede o limite de tamanho permitido.');
    }

    const html = await readReaderHtml(response);

    try {
      const thread = parseThreadHtml(html, normalized);
      if (!thread.posts.length || thread.posts.length > MAX_IMPORTED_POSTS) {
        throw new Error('A thread não contém uma quantidade válida de posts.');
      }
      return thread;
    } catch {
      throw new BadGatewayException('Não consegui extrair essa thread. Confira se o link é público e tente novamente.');
    }
  }

  async listThreads(userId: string, search?: string): Promise<SavedThreadSummary[]> {
    const query = search?.trim();
    const where = query
      ? {
          userId,
          OR: [
            { title: { contains: query } },
            { authorName: { contains: query } },
            { authorHandle: { contains: query } },
          ],
        }
      : { userId };
    const records = await this.prisma.savedThread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return records.map((record) => this.toSummary(record));
  }

  async getThread(userId: string, id: string): Promise<SavedThreadDetail> {
    const record = await this.prisma.savedThread.findFirst({ where: { id, userId } });
    if (!record) throw new NotFoundException('Thread salva não encontrada.');
    return this.toDetail(record);
  }

  async createThread(userId: string, input: CreateThreadDto): Promise<SavedThreadDetail> {
    const record = await this.prisma.savedThread.create({
      data: {
        userId,
        title: input.title.trim(),
        sourceUrl: input.sourceUrl,
        authorName: input.authorName?.trim() ?? '',
        authorHandle: input.authorHandle?.trim() ?? '',
        postsJson: JSON.stringify(this.normalizePosts(input.posts)),
      },
    });
    return this.toDetail(record);
  }

  async updateThread(userId: string, id: string, input: UpdateThreadDto): Promise<SavedThreadDetail> {
    const data: { title?: string; postsJson?: string } = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.posts !== undefined) data.postsJson = JSON.stringify(this.normalizePosts(input.posts));
    if (!Object.keys(data).length) throw new BadRequestException('Informe ao menos o título ou os posts para atualizar.');

    const result = await this.prisma.savedThread.updateMany({ where: { id, userId }, data });
    if (!result.count) throw new NotFoundException('Thread salva não encontrada.');
    return this.getThread(userId, id);
  }

  async deleteThread(userId: string, id: string): Promise<{ deleted: true }> {
    const result = await this.prisma.savedThread.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Thread salva não encontrada.');
    return { deleted: true };
  }

  private normalizePosts(posts: ThreadPostDto[]): ThreadPost[] {
    return posts.map((post) => ({
      text: post.text,
      mediaUrls: (post.mediaUrls ?? []).filter((url) => {
        try {
          return new URL(url).hostname === 'pbs.twimg.com' && new URL(url).protocol === 'https:';
        } catch {
          return false;
        }
      }),
    }));
  }

  private toSummary(record: SavedThread): SavedThreadSummary {
    const detail = this.toDetail(record);
    const { posts, ...summary } = detail;
    return { ...summary, postCount: posts.length, preview: posts[0]?.text ?? '' };
  }

  private toDetail(record: SavedThread): SavedThreadDetail {
    let posts: ThreadPost[];
    try {
      const parsed: unknown = JSON.parse(record.postsJson);
      if (!Array.isArray(parsed)) throw new Error('postsJson não é uma lista');
      posts = parsed as ThreadPost[];
    } catch {
      throw new InternalServerErrorException('Os posts dessa thread estão corrompidos.');
    }
    return {
      id: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
      authorName: record.authorName,
      authorHandle: record.authorHandle,
      posts,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
