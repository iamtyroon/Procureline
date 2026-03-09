import { ServiceUnavailableException } from "@nestjs/common";
import { PaymentsService } from "@/payments/payments.service";

describe("PaymentsService", () => {
  const stripeProvider = {
    constructWebhookEvent: jest.fn(),
    createSubscription: jest.fn(),
  };
  const intaSendProvider = {
    createCheckout: jest.fn(),
    verifyCallback: jest.fn(),
  };
  const bankTransferProvider = {
    verifyTransfer: jest.fn(),
  };
  const convexSyncService = {
    claimSync: jest.fn(),
    completeSync: jest.fn(),
    failSync: jest.fn(),
  };

  let paymentsService: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    convexSyncService.claimSync.mockResolvedValue({ status: "claimed" });
    convexSyncService.completeSync.mockResolvedValue({ status: "completed" });
    convexSyncService.failSync.mockResolvedValue({ status: "failed" });
    stripeProvider.createSubscription.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/pay/test",
      provider: "stripe",
    });
    bankTransferProvider.verifyTransfer.mockResolvedValue({
      paymentReference: "bank_1",
      verified: true,
    });

    paymentsService = new PaymentsService(
      stripeProvider as never,
      intaSendProvider as never,
      bankTransferProvider as never,
      convexSyncService as never,
    );
  });

  it("claims then completes direct payment verification", async () => {
    const result = await paymentsService.verifyPayment(
      {
        paymentReference: "pay_1",
        provider: "stripe",
      },
      {
        role: "tenant_admin",
        sub: "user_1",
        tenantId: "tenant_1",
      } as never,
    );

    expect(result).toEqual({
      paymentReference: "pay_1",
      status: "verified",
    });
    expect(convexSyncService.claimSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment-verification:stripe:pay_1",
      }),
    );
    expect(convexSyncService.completeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "payment-verification:stripe:pay_1",
      }),
    );
  });

  it("returns duplicate verification results without calling completeSync twice", async () => {
    convexSyncService.claimSync.mockResolvedValueOnce({ status: "duplicate" });

    const result = await paymentsService.verifyPayment(
      {
        paymentReference: "pay_1",
        provider: "stripe",
      },
      {
        role: "tenant_admin",
        sub: "user_1",
        tenantId: "tenant_1",
      } as never,
    );

    expect(result).toEqual({
      duplicate: true,
      paymentReference: "pay_1",
      status: "verified",
    });
    expect(convexSyncService.completeSync).not.toHaveBeenCalled();
  });

  it("fails the claim when provider checkout throws after a subscription is claimed", async () => {
    stripeProvider.createSubscription.mockRejectedValueOnce(new Error("stripe offline"));

    await expect(
      paymentsService.createSubscription(
        {
          amount: 1000,
          currency: "KES",
          customerReference: "cust_1",
          provider: "stripe",
        },
        {
          role: "tenant_admin",
          sub: "user_1",
          tenantId: "tenant_1",
        } as never,
      ),
    ).rejects.toThrow("stripe offline");

    expect(convexSyncService.failSync).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "PAYMENT_PROVIDER_FAILED",
        }),
      }),
    );
  });

  it("surfaces a service-unavailable error when subscription sync completion fails", async () => {
    convexSyncService.completeSync.mockRejectedValueOnce(new Error("sync failed"));

    await expect(
      paymentsService.createSubscription(
        {
          amount: 1000,
          currency: "KES",
          customerReference: "cust_1",
          idempotencyKey: "f6a52b56-c2da-4b10-a590-5c6470af66f4",
          provider: "stripe",
        },
        {
          role: "tenant_admin",
          sub: "user_1",
          tenantId: "tenant_1",
        } as never,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(convexSyncService.failSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "subscription-create:stripe:f6a52b56-c2da-4b10-a590-5c6470af66f4",
      }),
    );
  });
});
