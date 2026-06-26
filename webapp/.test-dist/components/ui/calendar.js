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
            month_caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            button_previous: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: "outline" }), "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
            button_next: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: "outline" }), "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
            month_grid: "w-full border-collapse space-y-1",
            weekdays: "flex",
            weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
            week: "flex w-full mt-2",
            day: (0, utils_1.cn)("relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent", props.mode === "range"
                ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
                : "[&:has([aria-selected])]:rounded-md"),
            day_button: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: "ghost" }), "h-8 w-8 p-0 font-normal aria-selected:opacity-100"),
            range_start: "day-range-start",
            range_end: "day-range-end",
            selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            today: "bg-accent text-accent-foreground",
            outside: "text-muted-foreground opacity-50",
            disabled: "text-muted-foreground opacity-50",
            range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            hidden: "invisible",
            ...classNames,
        }, components: {
            Chevron: ({ orientation }) => orientation === "left" ? ((0, jsx_runtime_1.jsx)(react_icons_1.ChevronLeftIcon, { className: "h-4 w-4" })) : ((0, jsx_runtime_1.jsx)(react_icons_1.ChevronRightIcon, { className: "h-4 w-4" })),
        }, ...props }));
}
exports.Calendar = Calendar;
Calendar.displayName = "Calendar";
