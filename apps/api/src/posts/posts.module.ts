import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPostsController } from './admin-posts.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [AuthModule],
  controllers: [PostsController, AdminPostsController],
  providers: [PostsService],
})
export class PostsModule {}
