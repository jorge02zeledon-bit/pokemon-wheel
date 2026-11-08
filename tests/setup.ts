import { config as loadEnv } from "dotenv";

// Tests always run against the dedicated test database and in demo mode.
loadEnv({ path: ".env.test", override: true });
process.env.REAL_MONEY_ENABLED ??= "false";
