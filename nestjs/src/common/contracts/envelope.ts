export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function successEnvelope<T>(data: T): SuccessEnvelope<T> {
  return {
    success: true,
    data,
  };
}

export function isEnvelopeResponse(value: unknown): value is SuccessEnvelope<unknown> | ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success?: unknown }).success === "boolean"
  );
}
