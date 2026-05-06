"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePlatformAdminAuthStage = exports.consumePlatformAdminBackupCode = exports.normalizePlatformAdminBackupCode = exports.maskPlatformAdminEmail = exports.getPlatformAdminRedirectPath = exports.isPlatformAdminAuthStageVerified = exports.isPlatformAdminAuthRoute = exports.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON = exports.PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE = exports.PLATFORM_ADMIN_BACKUP_CODE_COUNT = exports.PLATFORM_ADMIN_CHALLENGE_LOCKOUT_WINDOW_MS = exports.PLATFORM_ADMIN_CHALLENGE_LOCKOUT_THRESHOLD = exports.PLATFORM_ADMIN_CHALLENGE_WINDOW_MS = exports.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS = exports.PLATFORM_ADMIN_AUTH_ROUTES = void 0;
exports.PLATFORM_ADMIN_AUTH_ROUTES = [
    "/platform-admin/login",
    "/platform-admin/setup-2fa",
    "/platform-admin/verify",
];
exports.PLATFORM_ADMIN_INACTIVITY_WINDOW_MS = 1000 * 60 * 30;
exports.PLATFORM_ADMIN_CHALLENGE_WINDOW_MS = 1000 * 60 * 15;
exports.PLATFORM_ADMIN_CHALLENGE_LOCKOUT_THRESHOLD = 5;
exports.PLATFORM_ADMIN_CHALLENGE_LOCKOUT_WINDOW_MS = 1000 * 60 * 15;
exports.PLATFORM_ADMIN_BACKUP_CODE_COUNT = 8;
exports.PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE = "Platform Admin accounts cannot be deleted";
exports.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON = "password_reset_required";
function isPlatformAdminAuthRoute(pathname) {
    return exports.PLATFORM_ADMIN_AUTH_ROUTES.some((route) => route === pathname);
}
exports.isPlatformAdminAuthRoute = isPlatformAdminAuthRoute;
function isPlatformAdminAuthStageVerified(stage) {
    return stage === "not_applicable" || stage === "verified";
}
exports.isPlatformAdminAuthStageVerified = isPlatformAdminAuthStageVerified;
function getPlatformAdminRedirectPath(stage) {
    switch (stage) {
        case "setup_required":
            return "/platform-admin/setup-2fa";
        case "verification_required":
            return "/platform-admin/verify";
        case "reset_required":
            return `/platform-admin/login?reason=${exports.PLATFORM_ADMIN_PASSWORD_RESET_REQUIRED_REASON}`;
        case "verified":
        case "not_applicable":
        default:
            return "/platform-admin";
    }
}
exports.getPlatformAdminRedirectPath = getPlatformAdminRedirectPath;
function maskPlatformAdminEmail(email) {
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
exports.maskPlatformAdminEmail = maskPlatformAdminEmail;
function normalizePlatformAdminBackupCode(code) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
exports.normalizePlatformAdminBackupCode = normalizePlatformAdminBackupCode;
function consumePlatformAdminBackupCode(args) {
    const matchingCode = args.backupCodes.find((backupCode) => backupCode.codeHash === args.normalizedCodeHash);
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
        updatedBackupCodes: args.backupCodes.map((backupCode) => backupCode.codeHash === args.normalizedCodeHash
            ? {
                ...backupCode,
                consumedAt: args.now,
            }
            : { ...backupCode }),
        usedBackupCode: matchingCode,
    };
}
exports.consumePlatformAdminBackupCode = consumePlatformAdminBackupCode;
function resolvePlatformAdminAuthStage(args) {
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
exports.resolvePlatformAdminAuthStage = resolvePlatformAdminAuthStage;
