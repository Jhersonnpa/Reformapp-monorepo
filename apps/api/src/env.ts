import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";

function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
  return start;
}

// Funciona con cwd = raíz o apps/api (pnpm --filter usa el paquete).
// dotenv no sobrescribe vars ya definidas: el primer fichero que aporta
// una clave gana. `neon deploy` escribe en .env.local de la raíz.
const root = findWorkspaceRoot(process.cwd());
config({ path: join(root, ".env.local") });
config({ path: join(root, ".env") });
config({ path: join(root, "apps/api/.env") });
