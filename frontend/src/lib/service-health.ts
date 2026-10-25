import { parseJsonOrNull } from "./backend-errors";

/** How one link in the browser → Next.js → backend → Postgres chain is doing. */
export type ServiceStatus = "ok" | "down" | "unchecked";

export type ServiceCheck = { status: ServiceStatus; detail: string };

export type ServiceHealthReport = {
  frontend: ServiceCheck;
  backend: ServiceCheck;
  database: ServiceCheck;
};

export type ServiceName = keyof ServiceHealthReport;

/** Display order and labels for each link in the chain, upstream first. */
export const SERVICE_LABELS: Record<ServiceName, string> = {
  frontend: "Frontend (Next.js)",
  backend: "Backend API",
  database: "Database (Postgres)",
};

const SERVICE_STATUSES = new Set<ServiceStatus>(["ok", "down", "unchecked"]);

/** Used for every link after the first one that failed, since nothing past it could be tested. */
export const UNCHECKED_SERVICE: ServiceCheck = {
  status: "unchecked",
  detail: "Not checked — an earlier step failed.",
};

/** Whether a value has the shape of a single service check. */
function isServiceCheck(value: unknown): value is ServiceCheck {
  if (typeof value !== "object" || value === null) return false;
  const { status, detail } = value as Record<string, unknown>;
  return SERVICE_STATUSES.has(status as ServiceStatus) && typeof detail === "string";
}

/** Whether a parsed `/api/health` body is a complete report. */
export function isServiceHealthReport(value: unknown): value is ServiceHealthReport {
  if (typeof value !== "object" || value === null) return false;
  const report = value as Record<string, unknown>;
  return (Object.keys(SERVICE_LABELS) as ServiceName[]).every((name) =>
    isServiceCheck(report[name])
  );
}

/**
 * Runs the health check from the browser. When the Next.js server itself can't be reached or
 * answers with something other than a report, that first link is reported as down.
 */
export async function requestServiceHealthReport(): Promise<ServiceHealthReport> {
  let response: Response;
  try {
    response = await fetch("/api/health", { cache: "no-store" });
  } catch {
    return {
      frontend: {
        status: "down",
        detail:
          "Couldn't reach the Next.js server — you may be offline, or the frontend container is down.",
      },
      backend: UNCHECKED_SERVICE,
      database: UNCHECKED_SERVICE,
    };
  }

  const body = parseJsonOrNull(await response.text());
  if (isServiceHealthReport(body)) return body;
  return {
    frontend: {
      status: "down",
      detail: `The health check answered with HTTP ${response.status} instead of a report.`,
    },
    backend: UNCHECKED_SERVICE,
    database: UNCHECKED_SERVICE,
  };
}

/** Builds a plain-text summary of the diagnostics for pasting into a bug report or chat. */
export function formatDiagnosticsForCopy(
  report: ServiceHealthReport | null,
  error: (Error & { digest?: string }) | undefined,
  checkedAt: Date
): string {
  const lines = [`Bloom diagnostics — ${checkedAt.toISOString()}`];
  if (report) {
    for (const name of Object.keys(SERVICE_LABELS) as ServiceName[]) {
      lines.push(`${SERVICE_LABELS[name]}: ${report[name].status} — ${report[name].detail}`);
    }
  }
  if (error) {
    lines.push(`Error: ${error.message || error.name}`);
    if (error.digest) lines.push(`Reference: ${error.digest}`);
  }
  return lines.join("\n");
}
