import { config } from "@/server/config";
import type { IdentityProvider } from "./IdentityProvider";
import { MockIdentityProvider } from "./MockIdentityProvider";

let instance: IdentityProvider | null = null;

/** Identity provider selected by IDENTITY_PROVIDER. Only "mock" ships; add vendors here. */
export function getIdentityProvider(): IdentityProvider {
  if (instance) return instance;
  switch (config.identityProvider) {
    case "mock":
      instance = new MockIdentityProvider();
      break;
    default:
      throw new Error(`Unknown IDENTITY_PROVIDER "${config.identityProvider}". Implement it under src/server/providers/identity/.`);
  }
  return instance;
}

export type { IdentityProvider, StartResult, VerificationUpdate } from "./IdentityProvider";
