import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateRoundWord } from "@/lib/game/ai";

describe("AI gateway JSON mode fallback", () => {
  const originalGatewayKey = process.env.VERCEL_AI_GATEWAY_API_KEY;

  beforeEach(() => {
    process.env.VERCEL_AI_GATEWAY_API_KEY = "test-gateway-key";
  });

  afterEach(() => {
    process.env.VERCEL_AI_GATEWAY_API_KEY = originalGatewayKey;
  });

  it("retries without response_format when provider rejects it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '{"error":{"message":"Invalid input","param":"response_format","type":"invalid_request_error"}}',
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{\"word\":\"argousin\",\"correctDefinition\":\"vieux terme d'argot pour un agent de police\"}" } }],
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateRoundWord(1, []);

    expect(result.word).toBe("Argousin");
    expect(result.correctDefinition).toBe("Vieux terme d'argot pour un agent de police");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));

    expect(firstPayload.response_format).toEqual({ type: "json_object" });
    expect(secondPayload.response_format).toBeUndefined();
  });

  it("does not retry when the first error is unrelated to response_format", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('{"error":{"message":"provider down"}}', {
          status: 400,
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(generateRoundWord(1, [])).rejects.toThrow("Erreur IA (400)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
