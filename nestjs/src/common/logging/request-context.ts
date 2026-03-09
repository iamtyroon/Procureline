import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContextStore {
  correlationId: string;
}

export class RequestContextStorage {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run(correlationId: string, callback: () => void): void {
    this.storage.run({ correlationId }, callback);
  }

  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }
}

export const requestContextStorage = new RequestContextStorage();
