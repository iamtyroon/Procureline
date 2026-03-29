import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { EmailService } from "@/email/email.service";

describe("EmailService", () => {
  const webhookSecret = "resend-test-secret";
  const queueService = {
    enqueue: jest.fn().mockResolvedValue({ id: "job-1" }),
    remove: jest.fn().mockResolvedValue({ removed: false }),
  };
  const convexSyncService = {
    claimSync: jest.fn().mockResolvedValue({ status: "claimed" }),
    completeSync: jest.fn().mockResolvedValue({ status: "completed" }),
    failSync: jest.fn().mockResolvedValue({ status: "failed" }),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "resendWebhookSecret") return webhookSecret;
      return undefined;
    }),
  };

  let emailService: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailService(
      queueService as never,
      convexSyncService as never,
      configService as never,
    );
  });

  describe("queueEmail", () => {
    it("claims the sync event and enqueues the email", async () => {
      const result = await emailService.queueEmail(
        {
          idempotencyKey: "key-1",
          subject: "Test",
          template: "generic-notification",
          to: "test@example.com",
        } as never,
        { sub: "user_1", tenantId: "tenant_1", role: "tenant_admin" } as never,
      );

      expect(convexSyncService.claimSync).toHaveBeenCalledWith(
        expect.objectContaining({
          eventKey: "email:key-1",
          provider: "email",
        }),
      );
      expect(queueService.enqueue).toHaveBeenCalled();
      expect(result.queued).toBe(true);
      expect(result.jobId).toBe("job-1");
    });

    it("returns duplicate when the idempotency key is already claimed", async () => {
      convexSyncService.claimSync.mockResolvedValueOnce({ status: "duplicate" });
      const result = await emailService.queueEmail(
        {
          idempotencyKey: "key-1",
          subject: "Test",
          template: "generic-notification",
          to: "test@example.com",
        } as never,
        { sub: "user_1", tenantId: "tenant_1", role: "tenant_admin" } as never,
      );

      expect(result.duplicate).toBe(true);
      expect(result.queued).toBe(false);
      expect(queueService.enqueue).not.toHaveBeenCalled();
    });

    it("marks the sync event as failed when queueing throws after the claim succeeds", async () => {
      queueService.enqueue.mockRejectedValueOnce(new Error("redis down"));

      await expect(
        emailService.queueEmail(
          {
            idempotencyKey: "key-1",
            subject: "Test",
            template: "generic-notification",
            to: "test@example.com",
          } as never,
          { sub: "user_1", tenantId: "tenant_1", role: "tenant_admin" } as never,
        ),
      ).rejects.toThrow("redis down");

      expect(convexSyncService.failSync).toHaveBeenCalledWith(
        expect.objectContaining({
          eventKey: "email:key-1",
          error: expect.objectContaining({
            code: "QUEUE_ENQUEUE_FAILED",
          }),
        }),
      );
    });

    it("converts a deliverAt timestamp into a BullMQ delay", async () => {
      await emailService.queueEmail(
        {
          deliverAt: Date.now() + 60_000,
          idempotencyKey: "key-delay",
          subject: "Reminder",
          template: "deadline-reminder",
          to: "test@example.com",
        } as never,
        { sub: "user_1", tenantId: "tenant_1", role: "tenant_admin" } as never,
      );

      expect(queueService.enqueue).toHaveBeenCalledWith(
        "email.send",
        expect.any(Object),
        expect.objectContaining({
          delay: expect.any(Number),
          jobId: "key-delay",
        }),
      );
    });
  });

  describe("cancelQueuedEmail", () => {
    it("removes the queued job and completes the sync record", async () => {
      queueService.remove = jest.fn().mockResolvedValue({ removed: true });

      const result = await emailService.cancelQueuedEmail("key-1");

      expect(result).toEqual({
        cancelled: true,
        eventKey: "email:key-1",
      });
      expect(convexSyncService.completeSync).toHaveBeenCalledWith(
        expect.objectContaining({
          eventKey: "email:key-1",
        }),
      );
    });
  });

  describe("verifyWebhookSignature", () => {
    it("accepts a valid HMAC signature", () => {
      const payload = JSON.stringify({ type: "email.sent", data: { id: "evt_1" } });
      const signature = createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      expect(() => emailService.verifyWebhookSignature(payload, signature)).not.toThrow();
    });

    it("rejects a missing signature", () => {
      expect(() => emailService.verifyWebhookSignature("payload")).toThrow(UnauthorizedException);
    });

    it("rejects an invalid signature", () => {
      expect(() => emailService.verifyWebhookSignature("payload", "bad-sig")).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("handleWebhook", () => {
    it("processes a webhook and completes the sync", async () => {
      const payload = { type: "email.sent", data: { id: "evt_1" } };
      const rawBody = JSON.stringify(payload);
      const signature = createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const result = await emailService.handleWebhook(payload, rawBody, signature);

      expect(result.processed).toBe(true);
      expect(convexSyncService.claimSync).toHaveBeenCalledWith(
        expect.objectContaining({ eventKey: "resend:evt_1" }),
      );
      expect(convexSyncService.completeSync).toHaveBeenCalled();
    });

    it("returns duplicate for already-processed webhooks", async () => {
      convexSyncService.claimSync.mockResolvedValueOnce({ status: "duplicate" });
      const payload = { type: "email.sent", data: { id: "evt_1" } };
      const rawBody = JSON.stringify(payload);
      const signature = createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const result = await emailService.handleWebhook(payload, rawBody, signature);

      expect(result.duplicate).toBe(true);
      expect(convexSyncService.completeSync).not.toHaveBeenCalled();
    });

    it("calls failSync when completeSync fails", async () => {
      convexSyncService.completeSync.mockRejectedValueOnce(new Error("sync error"));
      const payload = { type: "email.sent", data: { id: "evt_1" } };
      const rawBody = JSON.stringify(payload);
      const signature = createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      await expect(emailService.handleWebhook(payload, rawBody, signature)).rejects.toThrow();
      expect(convexSyncService.failSync).toHaveBeenCalledWith(
        expect.objectContaining({ eventKey: "resend:evt_1" }),
      );
    });
  });
});
