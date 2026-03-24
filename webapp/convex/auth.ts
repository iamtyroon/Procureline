import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { Password } from "@convex-dev/auth/providers/Password";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { REMEMBER_ME_SESSION_WINDOW_MS } from "../lib/auth/session";
import {
  DEPARTMENT_USER_AUTH_PROVIDER,
  DEPARTMENT_USER_AUTH_START_FLOW,
  DEPARTMENT_USER_AUTH_VERIFY_FLOW,
} from "../lib/auth/department-user-access";
import {
  PROCUREMENT_OFFICER_AUTH_PROVIDER,
  PROCUREMENT_OFFICER_AUTH_START_FLOW,
  PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW,
} from "../lib/procurement-officer/invitations";
import { buildSecurityInputRejectedEvent } from "../lib/security/audit";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERNS,
  validateEmailInput,
  validateOneTimeCodeInput,
  validatePasswordLength,
} from "../lib/security/input";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";
import {
  startDepartmentUserOtpChallenge,
  verifyDepartmentUserOtpChallenge,
} from "./functions/departmentUserAuth";
import {
  startProcurementOfficerOtpChallenge,
  verifyProcurementOfficerOtpChallenge,
} from "./functions/procurementOfficerOnboarding";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  session: {
    totalDurationMs: REMEMBER_ME_SESSION_WINDOW_MS,
    inactiveDurationMs: REMEMBER_ME_SESSION_WINDOW_MS,
  },
  providers: [
    ConvexCredentials({
      id: DEPARTMENT_USER_AUTH_PROVIDER,
      extraProviders: [ResendOTP],
      authorize: async (params, ctx) => {
        const flow =
          typeof params.flow === "string" ? params.flow : "";
        const challengeId =
          typeof params.challengeId === "string" ? params.challengeId : "";
        const challengeDocId =
          challengeId as Id<"departmentUserAuthChallenges">;

        if (!challengeId) {
          throw new Error("Department User sign-in challenge expired. Start again.");
        }

        if (flow === DEPARTMENT_USER_AUTH_START_FLOW) {
          await startDepartmentUserOtpChallenge(ctx, challengeDocId);
          return null;
        }

        if (flow === DEPARTMENT_USER_AUTH_VERIFY_FLOW) {
          const codeResult = validateOneTimeCodeInput(String(params.code ?? ""), {
            field: "code",
            label: "Verification code",
          });
          if (!codeResult.ok) {
            throw new Error(codeResult.issue.message);
          }

          return await verifyDepartmentUserOtpChallenge(ctx, {
            challengeId: challengeDocId,
            code: codeResult.value,
          });
        }

        throw new Error("Unsupported Department User sign-in flow.");
      },
    }),
    ConvexCredentials({
      id: PROCUREMENT_OFFICER_AUTH_PROVIDER,
      extraProviders: [ResendOTP],
      authorize: async (params, ctx) => {
        const flow =
          typeof params.flow === "string" ? params.flow : "";
        const challengeId =
          typeof params.challengeId === "string" ? params.challengeId : "";
        const challengeDocId =
          challengeId as Id<"procurementOfficerAuthChallenges">;

        if (!challengeId) {
          throw new Error("Procurement Officer sign-in challenge expired. Start again.");
        }

        if (flow === PROCUREMENT_OFFICER_AUTH_START_FLOW) {
          await startProcurementOfficerOtpChallenge(ctx, challengeDocId);
          return null;
        }

        if (flow === PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW) {
          const codeResult = validateOneTimeCodeInput(String(params.code ?? ""), {
            field: "code",
            label: "Verification code",
          });
          if (!codeResult.ok) {
            throw new Error(codeResult.issue.message);
          }

          return await verifyProcurementOfficerOtpChallenge(ctx, {
            challengeId: challengeDocId,
            code: codeResult.value,
          });
        }

        throw new Error("Unsupported Procurement Officer sign-in flow.");
      },
    }),
    Password({
      verify: ResendOTP,
      reset: ResendPasswordReset,
      profile(params, ctx) {
        const flow =
          typeof params.flow === "string" ? params.flow : "unknown";
        const queueRejectedAuthInputAudit = (args: {
          field: string;
          outcome: Parameters<
            typeof buildSecurityInputRejectedEvent
          >[0]["outcome"];
          reason: string;
        }): void => {
          const entry = buildSecurityInputRejectedEvent({
            field: args.field,
            flow,
            outcome: args.outcome,
            path: "convex.auth",
            reason: args.reason,
          });
          void ctx
            .runMutation(
              internal.functions.auditLogs.appendAuditLogFromAction,
              {
                action: entry.action,
                actorRole: entry.actor.role,
                actorState: entry.actor.state,
                entityType: entry.entityType,
                event: entry.event,
                metadata: entry.metadata,
                outcome: entry.outcome,
                timestamp: entry.timestamp,
              },
            )
            .catch(() => undefined);
        };
        const emailResult = validateEmailInput(String(params.email ?? ""));
        if (!emailResult.ok) {
          queueRejectedAuthInputAudit({
            field: emailResult.issue.field,
            outcome: emailResult.issue.outcome,
            reason: emailResult.issue.reason,
          });
          throw new Error(emailResult.issue.message);
        }

        if (
          (flow === "email-verification" || flow === "reset-verification") &&
          params.code !== undefined
        ) {
          const codeLabel =
            flow === "email-verification" ? "Verification code" : "Reset code";
          const codeResult = validateOneTimeCodeInput(String(params.code), {
            field: "code",
            label: codeLabel,
          });
          if (!codeResult.ok) {
            queueRejectedAuthInputAudit({
              field: codeResult.issue.field,
              outcome: codeResult.issue.outcome,
              reason: codeResult.issue.reason,
            });
            throw new Error(codeResult.issue.message);
          }
        }

        const passwordCandidate =
          flow === "reset-verification"
            ? params.newPassword
            : params.password;
        if (typeof passwordCandidate === "string") {
          const passwordField =
            flow === "reset-verification" ? "newPassword" : "password";
          const passwordLengthResult = validatePasswordLength(
            passwordCandidate,
            passwordField,
          );
          if (!passwordLengthResult.ok) {
            queueRejectedAuthInputAudit({
              field: passwordLengthResult.issue.field,
              outcome: passwordLengthResult.issue.outcome,
              reason: passwordLengthResult.issue.reason,
            });
            throw new Error(passwordLengthResult.issue.message);
          }
        }

        return {
          email: emailResult.value,
        };
      },
      validatePasswordRequirements(password: string): void {
        if (password.length < PASSWORD_MIN_LENGTH) {
          throw new Error(
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
          );
        }
        if (password.length > 256) {
          throw new Error("Password must not exceed 256 characters");
        }
        if (!PASSWORD_PATTERNS.uppercase.test(password)) {
          throw new Error(
            "Password must contain at least one uppercase letter",
          );
        }
        if (!PASSWORD_PATTERNS.lowercase.test(password)) {
          throw new Error(
            "Password must contain at least one lowercase letter",
          );
        }
        if (!PASSWORD_PATTERNS.digit.test(password)) {
          throw new Error(
            "Password must contain at least one number",
          );
        }
        if (!PASSWORD_PATTERNS.special.test(password)) {
          throw new Error(
            "Password must contain at least one special character",
          );
        }
      },
    }),
  ],
});
