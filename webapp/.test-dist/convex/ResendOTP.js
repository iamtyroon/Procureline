"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendOTP = void 0;
const random_1 = require("@oslojs/crypto/random");
const emailTransport_1 = require("./emailTransport");
/**
 * Custom email OTP provider for Convex Auth.
 * In production it sends through Resend, and in development it can
 * capture messages into the Convex dev inbox transport.
 */
exports.ResendOTP = {
    id: "resend-otp",
    type: "email",
    name: "Resend OTP",
    from: "Procureline <onboarding@resend.dev>",
    maxAge: 60 * 15, // 15 minutes
    async generateVerificationToken() {
        const digits = "0123456789";
        return (0, random_1.generateRandomString)({
            read(bytes) {
                crypto.getRandomValues(bytes);
            },
        }, digits, 8);
    },
    async sendVerificationRequest(params) {
        const { identifier: email, token, provider } = params;
        const fromAddress = provider.from || "Procureline <onboarding@resend.dev>";
        const result = await (0, emailTransport_1.sendAppEmail)({
            debugCode: token,
            from: fromAddress,
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
            messageType: "auth_email_verification",
            subject: "Welcome to Procureline - Verify Your Email",
            text: `Your verification code is: ${token}. It expires in 15 minutes.`,
            to: [email],
        });
        if (!result.sent) {
            console.error("Email transport error:", result.errorMessage ?? "unknown");
            throw new Error(`Could not send verification email: ${result.errorMessage ?? "unknown email transport error"}`);
        }
    },
    options: {},
};
