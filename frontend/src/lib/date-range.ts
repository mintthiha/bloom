export type DateRangePreset = "this-month" | "previous-month" | "last-90-days" | "custom";

export type DateRangeState = {
  preset: DateRangePreset;
  start: string;
  end: string;
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatLocalDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function shiftLocalDate(value: string, days: number) {
  const next = parseLocalDate(value);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

export function buildDateRangeQuery(range: DateRangeState) {
  if (!range.start || !range.end) {
    return undefined;
  }

  const start = parseLocalDate(range.start);
  const endExclusive = parseLocalDate(range.preset === "custom" ? shiftLocalDate(range.end, 1) : range.end);

  return {
    start: start.toISOString(),
    end: endExclusive.toISOString(),
  };
}

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getPresetDateRange(preset: Exclude<DateRangePreset, "custom">, now = new Date()): DateRangeState {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "this-month") {
    return {
      preset,
      start: formatLocalDate(new Date(year, month, 1)),
      end: formatLocalDate(new Date(year, month + 1, 1)),
    };
  }

  if (preset === "previous-month") {
    return {
      preset,
      start: formatLocalDate(new Date(year, month - 1, 1)),
      end: formatLocalDate(new Date(year, month, 1)),
    };
  }

  const start = new Date(year, month, now.getDate());
  start.setDate(start.getDate() - 89);

  return {
    preset,
    start: formatLocalDate(start),
    end: formatLocalDate(new Date(year, month, now.getDate() + 1)),
  };
}
