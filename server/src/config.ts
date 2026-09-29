import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
