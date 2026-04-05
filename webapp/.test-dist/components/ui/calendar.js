"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Calendar = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_icons_1 = require("@radix-ui/react-icons");
const react_day_picker_1 = require("react-day-picker");
const utils_1 = require("@/lib/utils");
const button_1 = require("@/components/ui/button");
function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
    return ((0, jsx_runtime_1.jsx)(react_day_picker_1.DayPicker, { showOutsideDays: showOutsideDays, className: (0, utils_1.cn)("p-3", className), classNames: {
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: (0, utils_1.cn)("relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent", props.mode === "range"
                ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
                : "[&:has([aria-selected])]:rounded-md"),
            day: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: "ghost" }), "h-8 w-8 p-0 font-normal aria-selected:opacity-100"),
            day_range_start: "day-range-start",
            day_range_end: "day-range-end",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            ...classNames,
        }, components: {
            IconLeft: () => (0, jsx_runtime_1.jsx)(react_icons_1.ChevronLeftIcon, { className: "h-4 w-4" }),
            IconRight: () => (0, jsx_runtime_1.jsx)(react_icons_1.ChevronRightIcon, { className: "h-4 w-4" }),
        }, ...props }));
}
exports.Calendar = Calendar;
Calendar.displayName = "Calendar";
