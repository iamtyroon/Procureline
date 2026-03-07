import { Resend as ResendAPI } from "resend";
import { generateRandomString } from "@oslojs/crypto/random";

/**
 * Custom Resend OTP email provider for Convex Auth.
 * Conforms to the EmailConfig interface expected by Password({ verify }).
 */
export const ResendOTP: any = {
    id: "resend-otp",
    type: "email" as const,
    name: "Resend OTP",
    from: "Procureline <onboarding@resend.dev>",
    maxAge: 60 * 15, // 15 minutes

    async generateVerificationToken(): Promise<string> {
        const DIGITS = "0123456789";
        return generateRandomString(
            {
                read(bytes: Uint8Array): void {
                    crypto.getRandomValues(bytes);
                },
            },
            DIGITS,
            8,
        );
    },

    async sendVerificationRequest(
        params: {
            identifier: string;
            url: string;
            expires: Date;
            provider: { from?: string;[key: string]: unknown };
            token: string;
            request: Request;
            theme: { brandColor?: string; logo?: string };
        },
    ): Promise<void> {
        const { identifier: email, token, provider } = params;
        const apiKey = process.env.AUTH_RESEND_KEY;
        if (!apiKey) {
            throw new Error("AUTH_RESEND_KEY environment variable is not set");
        }

        const fromAddress = (provider.from as string) || "Procureline <onboarding@resend.dev>";
        const resend = new ResendAPI(apiKey);
        const { error } = await resend.emails.send({
            from: fromAddress,
            to: [email],
            subject: "Welcome to Procureline — Verify Your Email",
            text: `Your verification code is: ${token}. It expires in 15 minutes.`,
            html: `
        <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #18b969; margin-bottom: 8px;">Welcome to Procureline!</h2>
          <p style="color: #555; font-size: 15px;">Enter this code to verify your email address:</p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #18191b;">${token}</span>
          </div>
          <p style="color: #888; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
        });
        if (error) {
            console.error("Resend API error:", JSON.stringify(error));
            throw new Error(`Could not send verification email: ${JSON.stringify(error)}`);
        }
    },

    options: {},
};
