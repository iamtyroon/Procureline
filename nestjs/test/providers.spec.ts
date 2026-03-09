import { IntaSendProvider } from "@/payments/providers/intasend.provider";

describe("IntaSendProvider", () => {
  const provider = new IntaSendProvider({
    get: jest.fn((key: string) => {
      switch (key) {
        case "intasendPublishableKey":
          return "publishable";
        case "intasendSecretKey":
          return "secret";
        default:
          return undefined;
      }
    }),
  } as never);

  it("accepts matching callback signatures", () => {
    const payload = {
      invoice_id: "invoice-1",
    };
    const rawBody = JSON.stringify(payload);
    const signature = require("node:crypto")
      .createHmac("sha256", "secret")
      .update(rawBody)
      .digest("hex");

    expect(provider.verifyCallback(payload, rawBody, signature)).toBe("invoice-1");
  });

  it("rejects invalid callback signatures", () => {
    expect(() =>
      provider.verifyCallback(
        {
          invoice_id: "invoice-1",
        },
        JSON.stringify({ invoice_id: "invoice-1" }),
        "bad-signature",
      ),
    ).toThrow("Unauthorized Exception");
  });
});
