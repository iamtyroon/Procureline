export const PLATFORM_ADMIN_AUTH_ROUTES = [
    "/platform-admin/login",
    "/platform-admin/setup-2fa",
    "/platform-admin/verify",
] as const;

export const PLATFORM_ADMIN_INACTIVITY_WINDOW_MS = 1000 * 60 * 30;
export const PLATFORM_ADMIN_CHALLENGE_WINDOW_MS = 1000 * 60 * 15;
export const PLATFORM_ADMIN_CHALLENGE_LOCKOUT_THRESHOLD = 5;
export const PLATFORM_ADMIN_CHALLENGE_LOCKOUT_WINDOW_MS = 1000 * 60 * 15;
export const PLATFORM_ADMIN_BACKUP_CODE_COUNT = 8;
export const PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE =
    "Platform Admin accounts cannot be deleted";
export const PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON =
    "password_reset_required" as const;

export type PlatformAdminAuthStage =
    | "not_applicable"
    | "setup_required"
    | "verification_required"
    | "verified"
    | "reset_required";
export type PlatformAdminChallengePurpose = "setup" | "verify";
export type PlatformAdminChallengeFailureReason =
    | "already_consumed"
    | "invalid_code";
export type PlatformAdminRiskLevel = "normal" | "suspicious";
export type PlatformAdminRiskReason =
    | "country_changed"
    | "ip_changed"
    | "user_agent_changed";
export type PlatformAdminVerificationMethod = "email_otp" | "backup_code";

export interface PlatformAdminBackupCodeRecordLike {
    codeHash: string;
    consumedAt?: number;
    createdAt: number;
    suffix: string;
}

export function isPlatformAdminAuthRoute(pathname: string): boolean {
    return PLATFORM_ADMIN_AUTH_ROUTES.some((route) => route === pathname);
}

export function isPlatformAdminAuthStageVerified(
    stage: PlatformAdminAuthStage,
): boolean {
    return stage === "not_applicable" || stage === "verified";
}

export function getPlatformAdminRedirectPath(
    stage: PlatformAdminAuthStage,
): string {
    switch (stage) {
        case "setup_required":
            return "/platform-admin/setup-2fa";
        case "verification_required":
            return "/platform-admin/verify";
        case "reset_required":
            return `/platform-admin/login?reason=${PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON}`;
        case "verified":
        case "not_applicable":
        default:
            return "/platform-admin";
    }
}

export function maskPlatformAdminEmail(email: string): string {
    const separatorIndex = email.indexOf("@");
    if (separatorIndex === -1) {
        return email;
    }

    const localPart = email.slice(0, separatorIndex);
    const domain = email.slice(separatorIndex + 1);
    if (!localPart || !domain) {
        return email;
    }

    if (localPart.length <= 2) {
        return `${localPart[0] ?? "*"}***@${domain}`;
    }

    return `${localPart[0] ?? "*"}***${localPart.at(-1) ?? "*"}@${domain}`;
}

export function normalizePlatformAdminBackupCode(code: string): string {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function consumePlatformAdminBackupCode(args: {
    backupCodes: readonly PlatformAdminBackupCodeRecordLike[];
    normalizedCodeHash: string;
    now: number;
}):
    | {
          ok: true;
          updatedBackupCodes: PlatformAdminBackupCodeRecordLike[];
          usedBackupCode: PlatformAdminBackupCodeRecordLike;
      }
    | {
          ok: false;
          reason: PlatformAdminChallengeFailureReason;
      } {
    const matchingCode = args.backupCodes.find(
        (backupCode) => backupCode.codeHash === args.normalizedCodeHash,
    );

    if (!matchingCode) {
        return {
            ok: false,
            reason: "invalid_code",
        };
    }

    if (matchingCode.consumedAt !== undefined) {
        return {
            ok: false,
            reason: "already_consumed",
        };
    }

    return {
        ok: true,
        updatedBackupCodes: args.backupCodes.map((backupCode) =>
            backupCode.codeHash === args.normalizedCodeHash
                ? {
                      ...backupCode,
                      consumedAt: args.now,
                  }
                : { ...backupCode },
        ),
        usedBackupCode: matchingCode,
    };
}

export function resolvePlatformAdminAuthStage(args: {
    currentSessionStage?: PlatformAdminAuthStage | null;
    hasTwoFactorEnrollment: boolean;
    passwordResetRequiredAt?: number;
    storedBackupCodeCount: number;
}): PlatformAdminAuthStage {
    if (args.passwordResetRequiredAt !== undefined) {
        return "reset_required";
    }

    if (!args.hasTwoFactorEnrollment || args.storedBackupCodeCount === 0) {
        return "setup_required";
    }

    if (args.currentSessionStage === "verified") {
        return "verified";
    }

    return "verification_required";
}
