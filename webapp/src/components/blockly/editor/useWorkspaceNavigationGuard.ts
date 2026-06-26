import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
    createDepartmentUserWorkspaceLeaveGuardHistoryState,
    getDepartmentUserWorkspaceLeaveGuardHistoryAction,
    shouldInterceptDepartmentUserRouteNavigation,
} from "@/lib/frontend/blockly/workspace-draft-queue";

type PendingNavigationTarget = { kind: "back" } | { href: string; kind: "href" };

export function useWorkspaceNavigationGuard(args: {
    hasUnsyncedRisk: boolean;
    isSaveInFlightRef: RefObject<boolean>;
    mode: "edit" | "view";
    sessionId: string;
    shouldWarnBeforeLeave: boolean;
}) {
    const router = useRouter();
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const pendingTargetRef = useRef<PendingNavigationTarget | null>(null);
    const bypassRef = useRef(false);
    const historyGuardArmedRef = useRef(false);

    useEffect(() => {
        if (!args.shouldWarnBeforeLeave) return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [args.shouldWarnBeforeLeave]);

    useEffect(() => {
        if (!args.shouldWarnBeforeLeave) return;
        const handleDocumentClick = (event: MouseEvent) => {
            if (
                bypassRef.current || event.defaultPrevented || event.button !== 0 ||
                event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
            ) return;

            const target = event.target;
            if (!(target instanceof Element)) return;
            const anchor = target.closest("a[href]");
            if (!(anchor instanceof HTMLAnchorElement)) return;
            if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
            if (!shouldInterceptDepartmentUserRouteNavigation({
                currentUrl: window.location.href,
                hasUnsyncedRisk: args.hasUnsyncedRisk,
                isSaveInFlight: args.isSaveInFlightRef.current ?? false,
                mode: args.mode,
                nextUrl: anchor.href,
            })) return;

            event.preventDefault();
            pendingTargetRef.current = { href: anchor.href, kind: "href" };
            setIsExitDialogOpen(true);
        };
        document.addEventListener("click", handleDocumentClick, true);
        return () => document.removeEventListener("click", handleDocumentClick, true);
    }, [args.hasUnsyncedRisk, args.isSaveInFlightRef, args.mode, args.shouldWarnBeforeLeave]);

    useEffect(() => {
        const historyAction = getDepartmentUserWorkspaceLeaveGuardHistoryAction({
            historyState: window.history.state,
            isGuardArmed: historyGuardArmedRef.current,
            sessionId: args.sessionId,
            shouldWarnBeforeLeave: args.shouldWarnBeforeLeave,
        });
        if (historyAction === "disarm") {
            historyGuardArmedRef.current = false;
            bypassRef.current = true;
            window.history.back();
            const timeoutId = window.setTimeout(() => { bypassRef.current = false; }, 100);
            return () => window.clearTimeout(timeoutId);
        }
        if (!args.shouldWarnBeforeLeave) {
            historyGuardArmedRef.current = false;
            return;
        }
        if (historyAction === "arm") {
            window.history.pushState(
                createDepartmentUserWorkspaceLeaveGuardHistoryState(args.sessionId),
                "",
                window.location.href,
            );
            historyGuardArmedRef.current = true;
        }
        const handlePopState = () => {
            if (bypassRef.current) {
                bypassRef.current = false;
                return;
            }
            window.history.pushState(
                createDepartmentUserWorkspaceLeaveGuardHistoryState(args.sessionId),
                "",
                window.location.href,
            );
            pendingTargetRef.current = { kind: "back" };
            setIsExitDialogOpen(true);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [args.sessionId, args.shouldWarnBeforeLeave]);

    const onExitOpenChange = (open: boolean) => {
        if (!open) pendingTargetRef.current = null;
        setIsExitDialogOpen(open);
    };
    const confirmExit = () => {
        const target = pendingTargetRef.current ?? { href: "/du", kind: "href" as const };
        pendingTargetRef.current = null;
        setIsExitDialogOpen(false);
        bypassRef.current = true;
        if (target.kind === "back") window.history.back();
        else router.push(target.href);
        window.setTimeout(() => { bypassRef.current = false; }, 100);
    };
    const requestExit = () => {
        if (!args.shouldWarnBeforeLeave) {
            router.push("/du");
            return;
        }
        pendingTargetRef.current = { href: "/du", kind: "href" };
        setIsExitDialogOpen(true);
    };

    return { confirmExit, isExitDialogOpen, onExitOpenChange, requestExit };
}
