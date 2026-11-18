import { describe, expect, it } from "vitest";
import { minorToUsdc, usdcToMinor } from "./money";
import { transferStatus } from "./status";

describe("minorToUsdc", () => {
  it("converts cents to a USDC amount", () => {
    expect(minorToUsdc(1)).toBe("0.01");
    expect(minorToUsdc(840)).toBe("8.40");
    expect(minorToUsdc(1234567)).toBe("12345.67");
  });
  it("rejects zero, negative and fractional amounts", () => {
    expect(() => minorToUsdc(0)).toThrow();
    expect(() => minorToUsdc(-5)).toThrow();
    expect(() => minorToUsdc(1.5)).toThrow();
  });
});

describe("usdcToMinor", () => {
  it("rounds down to the cent", () => {
    expect(usdcToMinor("8.4")).toBe(840);
    expect(usdcToMinor("8.409999")).toBe(840);
    expect(usdcToMinor("10")).toBe(1000);
  });
});

describe("transferStatus", () => {
  it("maps transaction states", () => {
    expect(transferStatus("COMPLETE")).toBe("paid");
    expect(transferStatus("FAILED")).toBe("failed");
    expect(transferStatus("DENIED")).toBe("failed");
    expect(transferStatus("CANCELLED")).toBe("failed");
    expect(transferStatus("CONFIRMED")).toBe("sent");
    expect(transferStatus(undefined)).toBe("sent");
  });
});
