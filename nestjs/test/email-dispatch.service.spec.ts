import { EmailDispatchService } from "@/email/email-dispatch.service";

describe("EmailDispatchService", () => {
  const convexSyncService = {
    claimReminderDispatch: jest.fn().mockResolvedValue({
      allowSend: true,
      reason: "ready",
      statusMessage: null,
    }),
  };
  const resendProvider = {
    sendEmail: jest.fn().mockResolvedValue({ accepted: true, id: "msg_1" }),
  };
  const emailTemplateRendererService = {
    renderTemplate: jest.fn().mockResolvedValue("<p>Rendered</p>"),
  };

  let service: EmailDispatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailDispatchService(
      convexSyncService as never,
      resendProvider as never,
      emailTemplateRendererService as never,
    );
  });

  it("sends normal transactional emails without reminder dispatch checks", async () => {
    const result = await service.send({
      idempotencyKey: "generic-1",
      subject: "Hello",
      template: "generic-notification",
      to: "user@example.com",
    } as never);

    expect(convexSyncService.claimReminderDispatch).not.toHaveBeenCalled();
    expect(emailTemplateRendererService.renderTemplate).toHaveBeenCalled();
    expect(resendProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "generic-1",
        subject: "Hello",
        to: "user@example.com",
      }),
    );
    expect(result).toEqual({ accepted: true, id: "msg_1" });
  });

  it("skips stale deadline reminders before rendering or sending", async () => {
    convexSyncService.claimReminderDispatch.mockResolvedValueOnce({
      allowSend: false,
      reason: "superseded",
      statusMessage:
        "Reminder dispatch skipped because a newer deadline version is already active.",
    });

    const result = await service.send({
      idempotencyKey: "reminder-1",
      subject: "Reminder",
      template: "deadline-reminder",
      templateProps: {
        reminderJobId: "job_123",
      },
      to: "user@example.com",
    } as never);

    expect(convexSyncService.claimReminderDispatch).toHaveBeenCalledWith({
      reminderJobId: "job_123",
    });
    expect(emailTemplateRendererService.renderTemplate).not.toHaveBeenCalled();
    expect(resendProvider.sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipReason:
        "Reminder dispatch skipped because a newer deadline version is already active.",
      skipped: true,
    });
  });
});
