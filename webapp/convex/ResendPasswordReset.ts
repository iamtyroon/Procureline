import { generateRandomString } from "@oslojs/crypto/random";
import { Resend as ResendAPI } from "resend";
import { buildPasswordResetLink } from "../lib/auth/password-reset";

export const PASSWORD_RESET_PROVIDER_ID = "resend-password-reset";
export const PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

export const ResendPasswordReset: any = {
    id: PASSWORD_RESET_PROVIDER_ID,
    type: "email" as const,
    name: "Resend Password Reset",
    from:
        process.env.AUTH_RESET_RESEND_FROM ??
        "Procureline <onboarding@resend.dev>",
    maxAge: PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS,

    async generateVerificationToken(): Promise<string> {
        const digits = "0123456789";
        return generateRandomString(
            {
                read(bytes: Uint8Array): void {
                    crypto.getRandomValues(bytes);
                },
            },
            digits,
            8,
        );
    },

    async sendVerificationRequest(
        params: {
            identifier: string;
            url: string;
            expires: Date;
            provider: { from?: string; [key: string]: unknown };
            token: string;
            request: Request;
            theme: { brandColor?: string; logo?: string };
        },
    ): Promise<void> {
        const { identifier: email, expires, provider, token } = params;
        const apiKey = process.env.AUTH_RESEND_KEY;
        if (!apiKey) {
            throw new Error("AUTH_RESEND_KEY environment variable is not set");
        }

        const resetUrl = buildPasswordResetLink(params.url, email, expires);

        const providerFrom =
            typeof provider.from === "string" ? provider.from : undefined;
        const fromAddress =
            providerFrom ??
            process.env.AUTH_RESET_RESEND_FROM ??
            "Procureline <onboarding@resend.dev>";
        const resend = new ResendAPI(apiKey);
        const formattedExpiry = expires.toUTCString();
        const { error } = await resend.emails.send({
            from: fromAddress,
            to: [email],
            subject: "Reset your Procureline password",
            text: [
                "We received a request to reset your Procureline password.",
                `Use this code: ${token}`,
                `Or open this link: ${resetUrl}`,
                `This reset link expires on ${formattedExpiry}.`,
                "If you did not request this, you can safely ignore this email.",
            ].join("\n"),
            html: `
        <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #18b969; margin-bottom: 8px;">Reset your Procureline password</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            We received a request to reset the password for <strong>${email}</strong>.
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Use the code below or open the secure reset link to continue.
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #18191b;">${token}</span>
          </div>
          <a
            href="${resetUrl}"
            style="display: inline-block; background: #18b969; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; margin-bottom: 20px;"
          >
            Reset password
          </a>
          <p style="color: #888; font-size: 13px; line-height: 1.6;">
            This reset link and code expire on ${formattedExpiry}. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
        });

        if (error) {
            throw new Error(
                `Could not send password reset email: ${JSON.stringify(error)}`,
            );
        }
    },

    options: {},
};
