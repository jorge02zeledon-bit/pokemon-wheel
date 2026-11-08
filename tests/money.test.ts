import { describe, expect, it } from "vitest";
import { bpsOfCents, formatBps, formatCents, parseDollarsToCents, percentOfCents, percentToBps } from "@/lib/money";

describe("money helpers", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-995)).toBe("-$9.95");
    expect(formatCents(220000, { compact: true })).toBe("$2,200");
    expect(formatCents(220050, { compact: true })).toBe("$2,200.50");
  });

  it("rejects non-integer cents", () => {
    expect(() => formatCents(1.5)).toThrow(TypeError);
  });

  it("parses dollar strings", () => {
    expect(parseDollarsToCents("12.5")).toBe(1250);
    expect(parseDollarsToCents("$1,234.56")).toBe(123456);
    expect(parseDollarsToCents("300")).toBe(30000);
    expect(parseDollarsToCents("-4.05")).toBe(-405);
    expect(() => parseDollarsToCents("1.234")).toThrow();
    expect(() => parseDollarsToCents("abc")).toThrow();
  });

  it("applies percentages and basis points with cent rounding", () => {
    expect(percentOfCents(14000, 80)).toBe(11200); // 80% buyback on a $140 item
    expect(percentOfCents(1100, 80)).toBe(880);
    expect(percentOfCents(999, 80)).toBe(799); // 799.2 rounds down
    expect(bpsOfCents(10000, 200)).toBe(200); // 2% of $100
    expect(percentToBps(12.5)).toBe(1250);
    expect(formatBps(1250)).toBe("12.5%");
    expect(formatBps(100)).toBe("1%");
    expect(formatBps(8000)).toBe("80%");
  });
});
