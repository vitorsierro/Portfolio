import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AdminListQueryDto, ListQueryDto } from './dto/list-query.dto';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title'],
    a: ['href', 'name', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublished(query: ListQueryDto) {
    const limit = query.limit ?? 10;
    const posts = await this.prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor
        ? { cursor: { id: query.cursor }, skip: 1 }
        : {}),
    });

    let nextCursor: string | null = null;
    if (posts.length > limit) {
      // Drop the look-ahead row and point the cursor at the LAST item we keep,
      // so the next page (cursor + skip:1) resumes right after it — no gap.
      posts.pop();
      nextCursor = posts[posts.length - 1]?.id ?? null;
    }

    return { items: posts.map((p) => this.toListItem(p)), nextCursor };
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, published: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return this.toPublicPost(post);
  }

  async listAll(query: AdminListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const term = query.q?.trim();

    // SQLite's LIKE is case-insensitive for ASCII by default, which is what
    // Prisma's `contains` compiles to. (Prisma's `mode: 'insensitive'` isn't
    // supported on SQLite, so don't reach for it here.)
    const where: Prisma.PostWhereInput = term
      ? {
          OR: [{ title: { contains: term } }, { slug: { contains: term } }],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((p) => this.toAdminListItem(p)),
      total,
      page,
      limit,
      pageCount: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return this.toAdminPost(post);
  }

  async create(dto: CreatePostDto) {
    const clash = await this.prisma.post.findUnique({
      where: { slug: dto.slug },
    });
    if (clash) {
      throw new ConflictException('Slug already in use');
    }
    const published = dto.published ?? false;
    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        body: dto.body,
        coverImageUrl: dto.coverImageUrl ?? null,
        tags: this.arrayToCsv(dto.tags ?? []),
        published,
        publishedAt: published ? new Date() : null,
      },
    });
    return this.toAdminPost(post);
  }

  async update(id: string, dto: UpdatePostDto) {
    const current = await this.prisma.post.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Post not found');
    }
    if (dto.slug && dto.slug !== current.slug) {
      const clash = await this.prisma.post.findUnique({
        where: { slug: dto.slug },
      });
      if (clash) {
        throw new ConflictException('Slug already in use');
      }
    }

    const data: Prisma.PostUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = dto.coverImageUrl || null;
    }
    if (dto.tags !== undefined) data.tags = this.arrayToCsv(dto.tags);
    if (dto.published !== undefined) {
      data.published = dto.published;
      if (dto.published && !current.publishedAt) {
        data.publishedAt = new Date();
      } else if (!dto.published) {
        data.publishedAt = null;
      }
    }

    const post = await this.prisma.post.update({ where: { id }, data });
    return this.toAdminPost(post);
  }

  async remove(id: string) {
    try {
      await this.prisma.post.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Post not found');
    }
    return { success: true as const };
  }

  // --- mappers -------------------------------------------------------------

  private toListItem(post: Post) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverImageUrl: post.coverImageUrl,
      tags: this.csvToArray(post.tags),
      excerpt: this.excerpt(post.body),
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    };
  }

  private toPublicPost(post: Post) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverImageUrl: post.coverImageUrl,
      tags: this.csvToArray(post.tags),
      bodyHtml: this.renderMarkdown(post.body),
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private toAdminListItem(post: Post) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      published: post.published,
      tags: this.csvToArray(post.tags),
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private toAdminPost(post: Post) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      body: post.body,
      coverImageUrl: post.coverImageUrl,
      tags: this.csvToArray(post.tags),
      published: post.published,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  // --- helpers -------------------------------------------------------------

  private renderMarkdown(body: string): string {
    const raw = marked.parse(body, { async: false });
    return sanitizeHtml(raw, SANITIZE_OPTIONS);
  }

  private excerpt(body: string, len = 180): string {
    const text = body
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > len ? `${text.slice(0, len).trimEnd()}…` : text;
  }

  private csvToArray(csv: string): string[] {
    return csv
      ? csv
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }

  private arrayToCsv(tags: string[]): string {
    return tags
      .map((t) => t.trim())
      .filter(Boolean)
      .join(',');
  }
}
