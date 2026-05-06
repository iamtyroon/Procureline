import { REMEMBER_ME_STORAGE_KEY } from "@/lib/shared/auth/session";

export * from "@/lib/shared/auth/session";

export function readRememberMeBootstrapValue(): boolean | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    const storedValue = window.sessionStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    if (storedValue === null) {
        return undefined;
    }

    return storedValue === "true";
}

export function writeRememberMeBootstrapValue(rememberMe: boolean): void {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.setItem(
        REMEMBER_ME_STORAGE_KEY,
        rememberMe ? "true" : "false",
    );
}

export function clearRememberMeBootstrapValue(): void {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
}
