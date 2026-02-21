import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";

const PASSWORD_MIN_LENGTH = 12;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const DIGIT_REGEX = /[0-9]/;
const SPECIAL_REGEX = /[^A-Za-z0-9]/;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: ResendOTP,
      validatePasswordRequirements(password: string): void {
        if (password.length < PASSWORD_MIN_LENGTH) {
          throw new Error(
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
          );
        }
        if (!UPPERCASE_REGEX.test(password)) {
          throw new Error(
            "Password must contain at least one uppercase letter",
          );
        }
        if (!LOWERCASE_REGEX.test(password)) {
          throw new Error(
            "Password must contain at least one lowercase letter",
          );
        }
        if (!DIGIT_REGEX.test(password)) {
          throw new Error(
            "Password must contain at least one number",
          );
        }
        if (!SPECIAL_REGEX.test(password)) {
          throw new Error(
            "Password must contain at least one special character",
          );
        }
      },
    }),
  ],
});
