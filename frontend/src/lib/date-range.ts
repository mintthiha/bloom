export type DateRangePreset = "this-month" | "previous-month" | "last-90-days" | "custom";

export type DateRangeState = {
  preset: DateRangePreset;
  start: string;
  end: string;
};

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getPresetDateRange(preset: Exclude<DateRangePreset, "custom">, now = new Date()): DateRangeState {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (preset === "this-month") {
    return {
      preset,
      start: formatDate(new Date(Date.UTC(year, month, 1))),
      end: formatDate(new Date(Date.UTC(year, month + 1, 1))),
    };
  }

  if (preset === "previous-month") {
    return {
      preset,
      start: formatDate(new Date(Date.UTC(year, month - 1, 1))),
      end: formatDate(new Date(Date.UTC(year, month, 1))),
    };
  }

  const start = new Date(Date.UTC(year, month, now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 89);

  return {
    preset,
    start: formatDate(start),
    end: formatDate(new Date(Date.UTC(year, month, now.getUTCDate() + 1))),
  };
}
