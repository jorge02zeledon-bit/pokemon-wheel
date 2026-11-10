/**
 * Runs the database seed during a Vercel build only when RUN_SEED=true.
 * Use it for the first deployment, then remove the variable: the seed would
 * otherwise reset product names/values to their starting values on every build.
 */
import { execSync } from "node:child_process";

if (process.env.RUN_SEED === "true") {
  console.log("RUN_SEED=true: running database seed…");
  execSync("npx prisma db seed", { stdio: "inherit" });
} else {
  console.log("RUN_SEED not set: skipping database seed.");
}
