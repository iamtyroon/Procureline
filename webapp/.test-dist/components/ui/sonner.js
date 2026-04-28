"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toaster = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const next_themes_1 = require("next-themes");
const sonner_1 = require("sonner");
const Toaster = ({ ...props }) => {
    const { theme = "system" } = (0, next_themes_1.useTheme)();
    return ((0, jsx_runtime_1.jsx)(sonner_1.Toaster, { closeButton: true, theme: theme, className: "toaster group", toastOptions: {
            classNames: {
                toast: "group toast group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-primary/30 group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-xl group-[.toaster]:shadow-black/20",
                closeButton: "group-[.toast]:border-border/80 group-[.toast]:bg-popover group-[.toast]:text-foreground group-[.toast]:hover:bg-muted group-[.toast]:hover:text-foreground",
                description: "group-[.toast]:text-foreground/80",
                actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            },
        }, ...props }));
};
exports.Toaster = Toaster;
