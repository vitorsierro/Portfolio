import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateThreadDto, ImportThreadDto, ListThreadsQueryDto, UpdateThreadDto } from './dto/threads.dto';
import { ThreadsService } from './threads.service';

@Controller('admin/threads')
@UseGuards(JwtAuthGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Post('import')
  importThread(@Body() body: ImportThreadDto) {
    return this.threadsService.importThread(body.sourceUrl);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListThreadsQueryDto) {
    return this.threadsService.listThreads(this.userId(request), query.q);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.threadsService.getThread(this.userId(request), id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateThreadDto) {
    return this.threadsService.createThread(this.userId(request), body);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateThreadDto,
  ) {
    return this.threadsService.updateThread(this.userId(request), id, body);
  }

  @Delete(':id')
  delete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.threadsService.deleteThread(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    const id = request.user?.sub;
    if (!id) throw new UnauthorizedException('Identidade administrativa ausente.');
    return id;
  }
}
