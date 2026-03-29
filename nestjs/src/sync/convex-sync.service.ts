import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { AppConfig } from "@/common/config/app-config";

export interface SyncActorContext {
  role?: string;
  tenantId?: string;
  userId?: string;
}

export interface ClaimSyncInput {
  actor?: SyncActorContext;
  eventKey: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  payload: unknown;
  provider: string;
}

export interface CompleteSyncInput {
  durableChanges: Record<string, unknown>[];
  eventKey: string;
  result: Record<string, unknown>;
}

export interface FailSyncInput {
  durableChanges?: Record<string, unknown>[];
  error: {
    code: string;
    message: string;
  };
  eventKey: string;
}

interface SyncEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

@Injectable()
export class ConvexSyncService {
  private readonly convexUrl: string;
  private readonly syncSecret: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.convexUrl = configService.get("convexUrl", { infer: true });
    this.syncSecret = configService.get("procurelineConvexSyncSecret", { infer: true });
  }

  async claimSync(input: ClaimSyncInput): Promise<{ status: "claimed" | "duplicate" }> {
    return this.postSyncCommand("claim", {
      actor: input.actor,
      eventKey: input.eventKey,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      payloadHash: this.createPayloadHash(input.payload),
      provider: input.provider,
    });
  }

  async completeSync(input: CompleteSyncInput): Promise<{ status: "completed" }> {
    return this.postSyncCommand("complete", { ...input });
  }

  async failSync(input: FailSyncInput): Promise<{ status: "failed" }> {
    return this.postSyncCommand("fail", { ...input });
  }

  async claimReminderDispatch(input: {
    reminderJobId: string;
  }): Promise<{
    allowSend: boolean;
    reason: "inactive" | "ready" | "superseded";
    statusMessage: string | null;
  }> {
    return this.postJson("/api/services/deadlines/reminder-dispatch", {
      reminderJobId: input.reminderJobId,
    });
  }

  private createPayloadHash(payload: unknown): string {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private async postSyncCommand<TResponse>(command: "claim" | "complete" | "fail", payload: Record<string, unknown>): Promise<TResponse> {
    return this.postJson("/api/services/sync", {
      command,
      ...payload,
    });
  }

  private async postJson<TResponse>(path: string, payload: Record<string, unknown>): Promise<TResponse> {
    const response = await fetch(`${this.convexUrl}${path}`, {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "x-procureline-sync-secret": this.syncSecret,
      },
      method: "POST",
    });

    const result = (await response.json()) as SyncEnvelope<TResponse>;
    if (!response.ok || !result.success || !result.data) {
      throw new ServiceUnavailableException({
        error: {
          code: result.error?.code ?? "CONVEX_SYNC_FAILED",
          message: result.error?.message ?? "Convex synchronization failed",
        },
      });
    }

    return result.data;
  }
}
