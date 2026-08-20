import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

rmSync(join(packageRoot, "dist"), { recursive: true, force: true });
rmSync(join(packageRoot, "tsconfig.build.tsbuildinfo"), { force: true });
console.log("cleaned");
