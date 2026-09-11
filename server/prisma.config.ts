import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

const here = path.dirname(fileURLToPath(import.meta.url));

// The Prisma CLI does not read `.env` on its own once a config file is
// present, so load it here. Deployed environments inject the variables
// directly and simply find nothing to load.
dotenv.config({ path: path.join(here, '.env'), quiet: true });

export default defineConfig({
  schema: path.join(here, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(here, 'prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
