import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Seeded admin: ${admin.email}`);

  // Sample posts (helpful to exercise the /blog infinite scroll).
  // Set SEED_SAMPLE_POSTS=false in production to skip them.
  const existing = await prisma.post.count();
  if (existing === 0 && process.env.SEED_SAMPLE_POSTS !== 'false') {
    const now = Date.now();
    const samples = Array.from({ length: 15 }, (_, i) => {
      const n = i + 1;
      return {
        title: `Post de exemplo ${n}`,
        slug: `post-de-exemplo-${n}`,
        body: `# Post de exemplo ${n}\n\nEste é um **post de exemplo** gerado pelo seed para testar o infinite scroll.\n\n- Item um\n- Item dois\n- Item três\n\n> Escrito em Markdown e renderizado no servidor.`,
        coverImageUrl: null,
        tags: 'exemplo,seed',
        published: true,
        // stagger createdAt so cursor pagination has a stable order
        createdAt: new Date(now - n * 60_000),
        publishedAt: new Date(now - n * 60_000),
      };
    });

    for (const data of samples) {
      await prisma.post.create({ data });
    }
    console.log(`Seeded ${samples.length} sample posts`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
