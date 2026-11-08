import { afterEach, describe, expect, it } from "vitest";
import { config, isDemoMode } from "@/server/config";
import { requireRealMoney, RealMoneyDisabledError } from "@/server/errors";

describe("REAL_MONEY_ENABLED gate", () => {
  afterEach(() => {
    process.env.REAL_MONEY_ENABLED = "false";
  });

  it("is off unless the env var is explicitly truthy", () => {
    for (const v of ["", "false", "0", "no", "off", "FALSE", "maybe"]) {
      process.env.REAL_MONEY_ENABLED = v;
      expect(config.realMoneyEnabled, `value ${JSON.stringify(v)}`).toBe(false);
      expect(isDemoMode()).toBe(true);
      expect(() => requireRealMoney()).toThrow(RealMoneyDisabledError);
    }
    delete process.env.REAL_MONEY_ENABLED;
    expect(config.realMoneyEnabled).toBe(false);
  });

  it("turns on only for true/1/yes/on", () => {
    for (const v of ["true", "1", "yes", "on", "TRUE"]) {
      process.env.REAL_MONEY_ENABLED = v;
      expect(config.realMoneyEnabled).toBe(true);
      expect(() => requireRealMoney()).not.toThrow();
    }
  });
});
