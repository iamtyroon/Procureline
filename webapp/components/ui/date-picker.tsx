"use client";

import { useEffect, useRef, useState } from "react";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { DateValue } from "react-aria-components";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateField,
  DateInput,
  DateSegment,
  Heading,
} from "react-aria-components";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  "aria-label"?: string;
  className?: string;
  isDisabled?: boolean;
  minValue?: DateValue;
  onChange: (value: DateValue | null) => void;
  value: DateValue | null;
}

export function DatePicker({
  className,
  value,
  onChange,
  ...props
}: DatePickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<DateValue | null>(value);
  const [focusedValue, setFocusedValue] = useState<DateValue>(
    value ?? props.minValue ?? today(getLocalTimeZone()),
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Sync draft when external value changes (e.g. form reset) while closed
  useEffect(() => {
    if (!isOpen) {
      setDraftValue(value);
      setFocusedValue(value ?? props.minValue ?? today(getLocalTimeZone()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, props.minValue]);

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setDraftValue(value);
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setDraftValue(value); setIsOpen(false); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value]);

  function handleOpen() {
    if (props.isDisabled) return;
    setDraftValue(value);
    setFocusedValue(value ?? props.minValue ?? today(getLocalTimeZone()));
    setIsOpen(true);
  }

  function handleToday() {
    const t = today(getLocalTimeZone());
    const val = props.minValue && t.compare(props.minValue) < 0 ? props.minValue : t;
    setDraftValue(val);
    setFocusedValue(val);
  }

  function handleCancel() { setDraftValue(value); setIsOpen(false); }
  function handleApply() { onChange(draftValue); setIsOpen(false); }

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      {/* DateField provides context for the date segments */}
      <DateField
        value={value}
        onChange={onChange}
        isDisabled={props.isDisabled}
        minValue={props.minValue}
        aria-label={props["aria-label"]}
      >
        <div
          className={cn(
            "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            props.isDisabled && "cursor-not-allowed opacity-50",
          )}
        >
          <DateInput className="flex flex-1 items-center gap-0.5 text-foreground">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="rounded-sm px-0.5 tabular-nums outline-none focus:bg-accent focus:text-accent-foreground data-[placeholder]:text-muted-foreground"
              />
            )}
          </DateInput>
          <button
            type="button"
            disabled={props.isDisabled}
            onClick={handleOpen}
            aria-label="Open calendar"
            className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </DateField>

      {/* Absolute-positioned calendar — stays inside the dialog DOM so Radix
          focus-trap and pointer events work correctly. The parent modal must
          have overflow-visible for the deadlines case. */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <Calendar
            className="p-3"
            focusedValue={focusedValue}
            onFocusChange={setFocusedValue}
            value={draftValue}
            minValue={props.minValue}
            onChange={(date) => {
              // Standalone Calendar — no auto-close, just update the draft
              setDraftValue(date);
            }}
          >
            <header className="mb-2 flex items-center justify-between">
              <Button
                slot="previous"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Heading className="text-sm font-medium text-foreground" />
              <Button
                slot="next"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </header>
            <CalendarGrid className="w-full border-collapse">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="h-7 w-8 text-center text-[0.8rem] font-normal text-muted-foreground">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className="h-8 w-8 rounded-md text-center text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-40 data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:bg-accent data-[today]:text-accent-foreground"
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
          <div className="grid grid-cols-3 gap-2 border-t border-border px-3 py-3">
            <button
              type="button"
              onClick={handleToday}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
