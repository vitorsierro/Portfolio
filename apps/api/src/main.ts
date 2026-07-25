import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { parseAllowedOrigins } from './auth/allowed-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // No Origin header = same-origin or a non-browser client — allow.
      if (!origin || parseAllowedOrigins().includes(origin)) {
        callback(null, true);
        return;
      }
      // Deny by omitting the CORS headers rather than throwing: an error here
      // surfaces as a 500, which turned a disallowed Origin into a broken
      // endpoint instead of a blocked one. The browser still refuses to
      // expose the response, and the mutating cookie routes stay protected by
      // OriginCheckGuard — which returns a deliberate 403.
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Rejeita campos desconhecidos em vez de descartá-los em silêncio —
      // um payload inesperado vira erro explícito, não comportamento mudo.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 3001);
}

bootstrap();
