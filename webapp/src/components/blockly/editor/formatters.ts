const kenyanCurrencyFormatter = new Intl.NumberFormat("en-KE", {
    currency: "KES",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
});

const submittedAtFormatter = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
});

export const formatKenyanCurrency = (amount: number): string =>
    kenyanCurrencyFormatter.format(amount);

export const formatSubmittedAtLabel = (timestamp: number): string =>
    submittedAtFormatter.format(timestamp);
