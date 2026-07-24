import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminListQueryDto } from './dto/list-query.dto';
import { PostsService } from './posts.service';

// All routes here require a valid admin access token.
@Controller('admin/posts')
@UseGuards(JwtAuthGuard)
export class AdminPostsController {
  constructor(private readonly postsService: PostsService) {}

  // List every post, including drafts (offset paginated).
  @Get()
  list(@Query() query: AdminListQueryDto) {
    return this.postsService.listAll(query);
  }

  // Fetch a single post with its raw markdown body (for the edit form).
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.postsService.getById(id);
  }
}
