import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../src/utils/prisma';
import { passwordSchema } from '../src/utils/password';

const input = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  password: passwordSchema,
}).parse({
  email: process.env.BOOTSTRAP_ADMIN_EMAIL,
  name: process.env.BOOTSTRAP_ADMIN_NAME,
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
});

async function run() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true } });
  if (existingAdmin) throw new Error(`Administrator already exists (${existingAdmin.email}). Bootstrap refused.`);
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new Error('A non-administrator user already uses the bootstrap email.');
  await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: 'ADMIN',
    },
  });
  console.log(JSON.stringify({ level: 'info', event: 'bootstrap_admin_created', email: input.email.toLowerCase() }));
}

run().catch((error) => {
  console.error(JSON.stringify({ level: 'error', event: 'bootstrap_admin_failed', message: String(error?.message || error) }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
