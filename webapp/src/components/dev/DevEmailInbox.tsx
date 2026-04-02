"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ExternalLink, Inbox, KeyRound, Link2, MailOpen, RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
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
    const [recipientFilter, setRecipientFilter] = useState("");
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    const filteredMessages = useMemo(() => {
        const normalizedFilter = recipientFilter.trim().toLowerCase();
        if (!messages) {
            return [];
        }

        if (normalizedFilter.length === 0) {
            return messages;
        }

        return messages.filter((message) => {
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
    }, [messages, recipientFilter]);

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

    const selectedMessage =
        filteredMessages.find((message) => message._id === selectedMessageId) ?? null;

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
                                        latest 50 messages
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <Input
                                    value={recipientFilter}
                                    onChange={(event) => setRecipientFilter(event.target.value)}
                                    placeholder="Filter by recipient, subject, or message type"
                                    className="w-full min-w-[260px] sm:w-[320px]"
                                />
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
                                <CardTitle className="text-lg">Message List</CardTitle>
                                <CardDescription>
                                    {filteredMessages.length} message
                                    {filteredMessages.length === 1 ? "" : "s"} matching the current filter.
                                </CardDescription>
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
                                                return (
                                                    <button
                                                        key={message._id}
                                                        type="button"
                                                        onClick={() => setSelectedMessageId(message._id)}
                                                        className={cn(
                                                            "flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors",
                                                            selected
                                                                ? "bg-primary/10"
                                                                : "hover:bg-muted/40",
                                                        )}
                                                    >
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
                                                                className="shrink-0 rounded-full"
                                                            >
                                                                {message.messageType}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatTimestamp(message.createdAt)}
                                                        </div>
                                                    </button>
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
                                                            icon={<KeyRound className="h-4 w-4" />}
                                                            label="Debug code"
                                                            value={
                                                                selectedMessage.debugCode ??
                                                                "No debug code stored for this message."
                                                            }
                                                        />
                                                        <HighlightPanel
                                                            icon={<Link2 className="h-4 w-4" />}
                                                            label="Debug link"
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
                                                        title="Text body"
                                                        body={selectedMessage.text}
                                                    />
                                                </>
                                            ) : null}

                                            {selectedMessage.metadata !== undefined ? (
                                                <>
                                                    <Separator />
                                                    <ContentPanel
                                                        title="Metadata"
                                                        body={JSON.stringify(
                                                            selectedMessage.metadata,
                                                            null,
                                                            2,
                                                        )}
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
    href,
    icon,
    label,
    value,
}: {
    href?: string;
    icon: JSX.Element;
    label: string;
    value: string;
}): JSX.Element {
    return (
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                {icon}
                {label}
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
    title,
}: {
    body: string;
    title: string;
}): JSX.Element {
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-foreground">
                {body}
            </pre>
        </div>
    );
}
