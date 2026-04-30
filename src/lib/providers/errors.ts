export type ErrorKind =
  | "auth_failed"
  | "rate_limited"
  | "bad_request"
  | "content_blocked"
  | "server_error"
  | "network_error"
  | "quota_exhausted"
  | "verification_required"
  | "unknown";

export interface NormalizedError {
  readonly kind: ErrorKind;
  readonly message: string;
  readonly httpStatus?: number;
  readonly retryAfterSeconds?: number;
  readonly model?: string;
  readonly deepLink?: string;
  readonly raw?: unknown;
}
