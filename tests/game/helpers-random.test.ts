import { describe, expect, it } from "vitest";
import { randomId, randomSessionToken } from "@/lib/game/helpers";

describe("secure random helpers", () => {
  it("generates prefixed ids with cryptographic-looking hex payload", () => {
    const id = randomId("player");
    expect(id).toMatch(/^player_[0-9a-f]{16}$/);
  });

  it("generates session tokens as 64-char lowercase hex", () => {
    const token = randomSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not return duplicates in a small sample", () => {
    const tokens = new Set<string>();

    for (let i = 0; i < 1000; i += 1) {
      tokens.add(randomSessionToken());
    }

    expect(tokens.size).toBe(1000);
  });
});
