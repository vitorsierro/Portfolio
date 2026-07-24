import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // Public: paginated list of published posts (feeds the infinite scroll).
  @Get()
  list(@Query() query: ListQueryDto) {
    return this.postsService.findPublished(query);
  }

  // Public: single published post by slug.
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  @HttpPost()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }
}
