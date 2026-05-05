"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatePicker = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const date_1 = require("@internationalized/date");
const react_aria_components_1 = require("react-aria-components");
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
function DatePicker({ className, value, onChange, ...props }) {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const [draftValue, setDraftValue] = (0, react_1.useState)(value);
    const [focusedValue, setFocusedValue] = (0, react_1.useState)(value ?? props.minValue ?? (0, date_1.today)((0, date_1.getLocalTimeZone)()));
    const wrapperRef = (0, react_1.useRef)(null);
    // Sync draft when external value changes (e.g. form reset) while closed
    (0, react_1.useEffect)(() => {
        if (!isOpen) {
            setDraftValue(value);
            setFocusedValue(value ?? props.minValue ?? (0, date_1.today)((0, date_1.getLocalTimeZone)()));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, props.minValue]);
    // Close on click-outside
    (0, react_1.useEffect)(() => {
        if (!isOpen)
            return;
        function onPointerDown(e) {
            if (!wrapperRef.current?.contains(e.target)) {
                setDraftValue(value);
                setIsOpen(false);
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, value]);
    // Close on Escape
    (0, react_1.useEffect)(() => {
        if (!isOpen)
            return;
        function onKeyDown(e) {
            if (e.key === "Escape") {
                setDraftValue(value);
                setIsOpen(false);
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, value]);
    function handleOpen() {
        if (props.isDisabled)
            return;
        setDraftValue(value);
        setFocusedValue(value ?? props.minValue ?? (0, date_1.today)((0, date_1.getLocalTimeZone)()));
        setIsOpen(true);
    }
    function handleToday() {
        const t = (0, date_1.today)((0, date_1.getLocalTimeZone)());
        const val = props.minValue && t.compare(props.minValue) < 0 ? props.minValue : t;
        setDraftValue(val);
        setFocusedValue(val);
    }
    function handleCancel() { setDraftValue(value); setIsOpen(false); }
    function handleApply() { onChange(draftValue); setIsOpen(false); }
    return ((0, jsx_runtime_1.jsxs)("div", { ref: wrapperRef, className: (0, utils_1.cn)("relative w-full", className), children: [(0, jsx_runtime_1.jsx)(react_aria_components_1.DateField, { value: value, onChange: onChange, isDisabled: props.isDisabled, minValue: props.minValue, "aria-label": props["aria-label"], children: (0, jsx_runtime_1.jsxs)("div", { className: (0, utils_1.cn)("flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", props.isDisabled && "cursor-not-allowed opacity-50"), children: [(0, jsx_runtime_1.jsx)(react_aria_components_1.DateInput, { className: "flex flex-1 items-center gap-0.5 text-foreground", children: (segment) => ((0, jsx_runtime_1.jsx)(react_aria_components_1.DateSegment, { segment: segment, className: "rounded-sm px-0.5 tabular-nums outline-none focus:bg-accent focus:text-accent-foreground data-[placeholder]:text-muted-foreground" })) }), (0, jsx_runtime_1.jsx)("button", { type: "button", disabled: props.isDisabled, onClick: handleOpen, "aria-label": "Open calendar", className: "ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "h-4 w-4" }) })] }) }), isOpen && ((0, jsx_runtime_1.jsxs)("div", { className: "absolute left-0 top-full z-50 mt-1.5 rounded-md border border-border bg-popover text-popover-foreground shadow-lg", children: [(0, jsx_runtime_1.jsxs)(react_aria_components_1.Calendar, { className: "p-3", focusedValue: focusedValue, onFocusChange: setFocusedValue, value: draftValue, minValue: props.minValue, onChange: (date) => {
                            // Standalone Calendar — no auto-close, just update the draft
                            setDraftValue(date);
                        }, children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-2 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(react_aria_components_1.Button, { slot: "previous", className: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(react_aria_components_1.Heading, { className: "text-sm font-medium text-foreground" }), (0, jsx_runtime_1.jsx)(react_aria_components_1.Button, { slot: "next", className: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsxs)(react_aria_components_1.CalendarGrid, { className: "w-full border-collapse", children: [(0, jsx_runtime_1.jsx)(react_aria_components_1.CalendarGridHeader, { children: (day) => ((0, jsx_runtime_1.jsx)(react_aria_components_1.CalendarHeaderCell, { className: "h-7 w-8 text-center text-[0.8rem] font-normal text-muted-foreground", children: day })) }), (0, jsx_runtime_1.jsx)(react_aria_components_1.CalendarGridBody, { children: (date) => ((0, jsx_runtime_1.jsx)(react_aria_components_1.CalendarCell, { date: date, className: "h-8 w-8 rounded-md text-center text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-40 data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:bg-accent data-[today]:text-accent-foreground" })) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-2 border-t border-border px-3 py-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleToday, className: "h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground", children: "Today" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleCancel, className: "h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleApply, className: "h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90", children: "Apply" })] })] }))] }));
}
exports.DatePicker = DatePicker;
