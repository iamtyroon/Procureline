"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
    ArrowDownUp,
    Check,
    Copy,
    ExternalLink,
    Inbox,
    KeyRound,
    Link2,
    MailOpen,
    RefreshCw,
    Search,
    Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Spinner } from "@/src/components/ui/Spinner";

function formatTimestamp(timestamp: number): string {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}

export function DevEmailInbox(): JSX.Element {
    const messages = useQuery(api.functions.devEmail.listRecentMessages, {});
    const deleteMessage = useMutation(api.functions.devEmail.deleteMessage);
    const deleteMessages = useMutation(api.functions.devEmail.deleteMessages);
    const [recipientFilter, setRecipientFilter] = useState("");
    const [messageTypeFilter, setMessageTypeFilter] = useState("all");
    const [sortDirection, setSortDirection] = useState<"newest" | "oldest">("newest");
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [checkedMessageIds, setCheckedMessageIds] = useState<Set<Id<"devEmailMessages">>>(
        () => new Set(),
    );
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const messageTypeOptions = useMemo(() => {
        if (!messages) {
            return [];
        }

        return Array.from(new Set(messages.map((message) => message.messageType))).sort();
    }, [messages]);

    const filteredMessages = useMemo(() => {
        const normalizedFilter = recipientFilter.trim().toLowerCase();
        if (!messages) {
            return [];
        }

        const matchingMessages = messages.filter((message) => {
            if (
                messageTypeFilter !== "all" &&
                message.messageType !== messageTypeFilter
            ) {
                return false;
            }

            if (normalizedFilter.length === 0) {
                return true;
            }

            const haystacks = [
                message.primaryRecipient,
                message.subject,
                message.messageType,
                message.to.join(" "),
            ];
            return haystacks.some((value) =>
                value.toLowerCase().includes(normalizedFilter),
            );
        });

        return [...matchingMessages].sort((first, second) =>
            sortDirection === "newest"
                ? second.createdAt - first.createdAt
                : first.createdAt - second.createdAt,
        );
    }, [messages, messageTypeFilter, recipientFilter, sortDirection]);

    const summary = useMemo(() => {
        const allMessages = messages ?? [];
        const otpCount = allMessages.filter((message) => message.debugCode).length;
        const linkCount = allMessages.filter((message) => message.debugLink).length;

        return {
            linkCount,
            otpCount,
            totalCount: allMessages.length,
        };
    }, [messages]);

    useEffect(() => {
        if (filteredMessages.length === 0) {
            setSelectedMessageId(null);
            return;
        }

        const selectedStillExists = filteredMessages.some(
            (message) => message._id === selectedMessageId,
        );
        if (!selectedStillExists) {
            setSelectedMessageId(filteredMessages[0]!._id);
        }
    }, [filteredMessages, selectedMessageId]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            const target = event.target;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement
            ) {
                return;
            }

            if (filteredMessages.length === 0) {
                return;
            }

            const selectedIndex = filteredMessages.findIndex(
                (message) => message._id === selectedMessageId,
            );
            if (event.key === "j" || event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex =
                    selectedIndex < 0
                        ? 0
                        : Math.min(filteredMessages.length - 1, selectedIndex + 1);
                setSelectedMessageId(filteredMessages[nextIndex]!._id);
            }
            if (event.key === "k" || event.key === "ArrowUp") {
                event.preventDefault();
                const nextIndex =
                    selectedIndex < 0 ? 0 : Math.max(0, selectedIndex - 1);
                setSelectedMessageId(filteredMessages[nextIndex]!._id);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredMessages, selectedMessageId]);

    const selectedMessage =
        filteredMessages.find((message) => message._id === selectedMessageId) ?? null;

    const visibleMessageIds = useMemo(
        () => filteredMessages.map((message) => message._id),
        [filteredMessages],
    );
    const selectedVisibleCount = visibleMessageIds.filter((messageId) =>
        checkedMessageIds.has(messageId),
    ).length;
    const allVisibleSelected =
        visibleMessageIds.length > 0 &&
        visibleMessageIds.every((messageId) => checkedMessageIds.has(messageId));

    useEffect(() => {
        if (!messages) {
            return;
        }

        const availableMessageIds = new Set(messages.map((message) => message._id));
        setCheckedMessageIds((current) => {
            const next = new Set(
                Array.from(current).filter((messageId) =>
                    availableMessageIds.has(messageId),
                ),
            );
            return next.size === current.size ? current : next;
        });
    }, [messages]);

    async function copyValue(value: string, key: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            const textArea = document.createElement("textarea");
            textArea.value = value;
            textArea.setAttribute("readonly", "true");
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
        setCopiedKey(key);
        window.setTimeout(() => setCopiedKey(null), 1200);
    }

    function toggleMessageChecked(messageId: Id<"devEmailMessages">): void {
        setCheckedMessageIds((current) => {
            const next = new Set(current);
            if (next.has(messageId)) {
                next.delete(messageId);
            } else {
                next.add(messageId);
            }
            return next;
        });
    }

    function toggleAllVisible(): void {
        setCheckedMessageIds((current) => {
            const next = new Set(current);
            if (allVisibleSelected) {
                for (const messageId of visibleMessageIds) {
                    next.delete(messageId);
                }
                return next;
            }

            for (const messageId of visibleMessageIds) {
                next.add(messageId);
            }
            return next;
        });
    }

    async function handleDeleteSelected(): Promise<void> {
        const messageIds = visibleMessageIds.filter((messageId) =>
            checkedMessageIds.has(messageId),
        );
        if (messageIds.length === 0) {
            return;
        }

        const confirmed = window.confirm(
            `Delete ${messageIds.length} selected email${
                messageIds.length === 1 ? "" : "s"
            } from the dev inbox?`,
        );
        if (!confirmed) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteMessages({ messageIds });
            setCheckedMessageIds((current) => {
                const next = new Set(current);
                for (const messageId of messageIds) {
                    next.delete(messageId);
                }
                return next;
            });
        } finally {
            setIsDeleting(false);
        }
    }

    async function handleDeleteMessage(
        messageId: Id<"devEmailMessages">,
    ): Promise<void> {
        const confirmed = window.confirm("Delete this email from the dev inbox?");
        if (!confirmed) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteMessage({ messageId });
            setCheckedMessageIds((current) => {
                const next = new Set(current);
                next.delete(messageId);
                return next;
            });
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                <Card className="overflow-hidden border-border/70 bg-card/95 shadow-lg shadow-primary/5">
                    <CardHeader className="border-b border-border/70 bg-muted/20">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                        <MailOpen className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-2xl">Dev Email Inbox</CardTitle>
                                        <CardDescription>
                                            Captured emails for local onboarding, OTP, and invite testing.
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="rounded-full">
                                        transport: dev_inbox
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full">
                                        {summary.totalCount}/50 loaded
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full">
                                        {summary.otpCount} with codes
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full">
                                        {summary.linkCount} with links
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto] lg:items-center">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={recipientFilter}
                                        onChange={(event) => setRecipientFilter(event.target.value)}
                                        placeholder="Search recipient, subject, type"
                                        className="w-full min-w-[260px] pl-9 lg:w-[320px]"
                                    />
                                </div>
                                <select
                                    value={messageTypeFilter}
                                    onChange={(event) => setMessageTypeFilter(event.target.value)}
                                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="all">All message types</option>
                                    {messageTypeOptions.map((messageType) => (
                                        <option key={messageType} value={messageType}>
                                            {messageType}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setSortDirection((current) =>
                                            current === "newest" ? "oldest" : "newest",
                                        )
                                    }
                                    className="rounded-xl"
                                >
                                    <ArrowDownUp className="mr-2 h-4 w-4" />
                                    {sortDirection === "newest" ? "Newest" : "Oldest"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => window.location.reload()}
                                    className="rounded-xl"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {messages === undefined ? (
                    <Card className="border-border/70">
                        <CardContent className="flex items-center justify-center gap-3 py-14">
                            <Spinner />
                            <p className="text-sm text-muted-foreground">
                                Loading captured emails...
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.35fr)]">
                        <Card className="border-border/70 bg-card/95 shadow-sm">
                            <CardHeader className="border-b border-border/70">
                                <div className="space-y-3">
                                    <div>
                                        <CardTitle className="text-lg">Message List</CardTitle>
                                        <CardDescription>
                                            {filteredMessages.length} message
                                            {filteredMessages.length === 1 ? "" : "s"} matching the current filter.
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            disabled={visibleMessageIds.length === 0}
                                            onClick={toggleAllVisible}
                                        >
                                            {allVisibleSelected ? "Clear visible" : "Select visible"}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="h-8 rounded-lg text-xs"
                                            disabled={selectedVisibleCount === 0 || isDeleting}
                                            onClick={() => void handleDeleteSelected()}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                            {selectedVisibleCount > 0
                                                ? `Delete ${selectedVisibleCount}`
                                                : "Delete selected"}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {filteredMessages.length === 0 ? (
                                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                            <Inbox className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">No captured messages yet</p>
                                            <p className="text-sm text-muted-foreground">
                                                Trigger signup, password reset, or an invite flow and it will show up here.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[640px]">
                                        <div className="divide-y divide-border/70">
                                            {filteredMessages.map((message) => {
                                                const selected = message._id === selectedMessageId;
                                                const checked = checkedMessageIds.has(message._id);
                                                return (
                                                    <div
                                                        key={message._id}
                                                        className={cn(
                                                            "grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-5 py-4 transition-colors",
                                                            selected
                                                                ? "bg-primary/10"
                                                                : "hover:bg-muted/40",
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            aria-label={`Select ${message.subject}`}
                                                            className="mt-1 h-4 w-4 rounded border-border accent-primary"
                                                            onChange={() => toggleMessageChecked(message._id)}
                                                            onClick={(event) => event.stopPropagation()}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedMessageId(message._id)}
                                                            className="min-w-0 text-left"
                                                        >
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="truncate font-medium text-foreground">
                                                                            {message.primaryRecipient}
                                                                        </div>
                                                                        <div className="truncate text-sm text-muted-foreground">
                                                                            {message.subject}
                                                                        </div>
                                                                    </div>
                                                                    <Badge
                                                                        variant={selected ? "default" : "outline"}
                                                                        className="max-w-[11rem] shrink-0 truncate rounded-full"
                                                                    >
                                                                        {message.messageType}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {formatTimestamp(message.createdAt)}
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {message.debugCode ? (
                                                                        <Badge variant="secondary" className="rounded-full">
                                                                            code
                                                                        </Badge>
                                                                    ) : null}
                                                                    {message.debugLink ? (
                                                                        <Badge variant="secondary" className="rounded-full">
                                                                            link
                                                                        </Badge>
                                                                    ) : null}
                                                                    {message.html ? (
                                                                        <Badge variant="secondary" className="rounded-full">
                                                                            html
                                                                        </Badge>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 bg-card/95 shadow-sm">
                            <CardHeader className="border-b border-border/70">
                                <CardTitle className="text-lg">Message Detail</CardTitle>
                                <CardDescription>
                                    Open a captured email to inspect its code, link, and body content.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!selectedMessage ? (
                                    <div className="flex min-h-[640px] items-center justify-center px-6 py-12 text-center">
                                        <div className="space-y-2">
                                            <p className="font-medium text-foreground">Select a message</p>
                                            <p className="text-sm text-muted-foreground">
                                                Its OTP, reset link, and rendered body will appear here.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[640px]">
                                        <div className="space-y-6 p-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                        Subject
                                                    </div>
                                                    <div className="mt-1 text-xl font-semibold text-foreground">
                                                        {selectedMessage.subject}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <CopyButton
                                                            copied={copiedKey === "subject"}
                                                            label="Copy subject"
                                                            onClick={() =>
                                                                void copyValue(
                                                                    selectedMessage.subject,
                                                                    "subject",
                                                                )
                                                            }
                                                        />
                                                        <CopyButton
                                                            copied={copiedKey === "recipient"}
                                                            label="Copy recipient"
                                                            onClick={() =>
                                                                void copyValue(
                                                                    selectedMessage.primaryRecipient,
                                                                    "recipient",
                                                                )
                                                            }
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            className="h-8 rounded-lg px-2.5 text-xs"
                                                            disabled={isDeleting}
                                                            onClick={() =>
                                                                void handleDeleteMessage(selectedMessage._id)
                                                            }
                                                        >
                                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                            Delete email
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <DetailBlock
                                                        label="Primary recipient"
                                                        value={selectedMessage.primaryRecipient}
                                                    />
                                                    <DetailBlock
                                                        label="Sent at"
                                                        value={formatTimestamp(selectedMessage.createdAt)}
                                                    />
                                                    <DetailBlock
                                                        label="From"
                                                        value={selectedMessage.from}
                                                    />
                                                    <DetailBlock
                                                        label="Recipients"
                                                        value={selectedMessage.to.join(", ")}
                                                    />
                                                </div>
                                            </div>

                                            {(selectedMessage.debugCode || selectedMessage.debugLink) ? (
                                                <>
                                                    <Separator />
                                                    <div className="grid gap-4 md:grid-cols-2">
                                                        <HighlightPanel
                                                            copied={copiedKey === "debug-code"}
                                                            icon={<KeyRound className="h-4 w-4" />}
                                                            label="Debug code"
                                                            onCopy={() =>
                                                                selectedMessage.debugCode
                                                                    ? void copyValue(
                                                                          selectedMessage.debugCode,
                                                                          "debug-code",
                                                                      )
                                                                    : undefined
                                                            }
                                                            value={
                                                                selectedMessage.debugCode ??
                                                                "No debug code stored for this message."
                                                            }
                                                        />
                                                        <HighlightPanel
                                                            copied={copiedKey === "debug-link"}
                                                            icon={<Link2 className="h-4 w-4" />}
                                                            label="Debug link"
                                                            onCopy={() =>
                                                                selectedMessage.debugLink
                                                                    ? void copyValue(
                                                                          selectedMessage.debugLink,
                                                                          "debug-link",
                                                                      )
                                                                    : undefined
                                                            }
                                                            value={
                                                                selectedMessage.debugLink ??
                                                                "No debug link stored for this message."
                                                            }
                                                            href={selectedMessage.debugLink}
                                                        />
                                                    </div>
                                                </>
                                            ) : null}

                                            {selectedMessage.text ? (
                                                <>
                                                    <Separator />
                                                    <ContentPanel
                                                        copied={copiedKey === "text-body"}
                                                        title="Text body"
                                                        body={selectedMessage.text}
                                                        onCopy={() =>
                                                            selectedMessage.text
                                                                ? void copyValue(
                                                                      selectedMessage.text,
                                                                      "text-body",
                                                                  )
                                                                : undefined
                                                        }
                                                    />
                                                </>
                                            ) : null}

                                            {selectedMessage.metadata !== undefined ? (
                                                <>
                                                    <Separator />
                                                    <ContentPanel
                                                        copied={copiedKey === "metadata"}
                                                        title="Metadata"
                                                        body={JSON.stringify(
                                                            selectedMessage.metadata,
                                                            null,
                                                            2,
                                                        )}
                                                        onCopy={() =>
                                                            void copyValue(
                                                                JSON.stringify(
                                                                    selectedMessage.metadata,
                                                                    null,
                                                                    2,
                                                                ),
                                                                "metadata",
                                                            )
                                                        }
                                                    />
                                                </>
                                            ) : null}

                                            {selectedMessage.html ? (
                                                <>
                                                    <Separator />
                                                    <div className="space-y-3">
                                                        <div className="text-sm font-semibold text-foreground">
                                                            HTML body
                                                        </div>
                                                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                                                            <iframe
                                                                title={`Email preview for ${selectedMessage.subject}`}
                                                                srcDoc={selectedMessage.html}
                                                                className="h-[420px] w-full bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : null}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

function DetailBlock({
    label,
    value,
}: {
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {label}
            </div>
            <div className="mt-2 break-words text-sm font-medium text-foreground">{value}</div>
        </div>
    );
}

function HighlightPanel({
    copied,
    href,
    icon,
    label,
    onCopy,
    value,
}: {
    copied?: boolean;
    href?: string;
    icon: JSX.Element;
    label: string;
    onCopy?: () => void;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    {icon}
                    {label}
                </div>
                {onCopy ? (
                    <CopyButton copied={copied ?? false} label="Copy" onClick={onCopy} />
                ) : null}
            </div>
            <div className="mt-3 break-words font-mono text-sm text-foreground">{value}</div>
            {href ? (
                <Button asChild variant="outline" className="mt-4 rounded-xl">
                    <a href={href} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open link
                    </a>
                </Button>
            ) : null}
        </div>
    );
}

function ContentPanel({
    body,
    copied,
    onCopy,
    title,
}: {
    body: string;
    copied?: boolean;
    onCopy?: () => void;
    title: string;
}): JSX.Element {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                {onCopy ? (
                    <CopyButton copied={copied ?? false} label="Copy" onClick={onCopy} />
                ) : null}
            </div>
            <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-foreground">
                {body}
            </pre>
        </div>
    );
}

function CopyButton({
    copied,
    label,
    onClick,
}: {
    copied: boolean;
    label: string;
    onClick: () => void;
}): JSX.Element {
    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={onClick}
        >
            {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : label}
        </Button>
    );
}
