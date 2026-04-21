/**
 * Normalized application errors for consistent UI messaging across Tauri invoke,
 * TanStack Query, and local validation.
 */

export type AppErrorCategory =
	| "connection"
	| "query"
	| "validation"
	| "transport"
	| "internal";

export type AppError = {
	/** Best-effort machine-readable code (e.g. Postgres SQLSTATE when present). */
	code?: string;
	category: AppErrorCategory;
	/** User-facing primary message (short). */
	message: string;
	/** Optional detail line for toasts or logs. */
	detail?: string;
	cause?: unknown;
};

function messageOf(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

/**
 * Heuristic: Postgres / libpq style errors often include "ERROR:" or SQLSTATE.
 */
function inferCategoryFromMessage(m: string): AppErrorCategory | undefined {
	const lower = m.toLowerCase();

	if (
		lower.includes("password authentication failed") ||
		lower.includes("authentication failed") ||
		lower.includes("could not connect") ||
		lower.includes("connection refused") ||
		lower.includes("connection timed out") ||
		lower.includes("no pg_hba.conf entry") ||
		(lower.includes("ssl") && lower.includes("certificate")) ||
		(lower.includes("database") && lower.includes("does not exist"))
	) {
		return "connection";
	}

	if (
		lower.includes("syntax error") ||
		(lower.includes("relation") && lower.includes("does not exist")) ||
		(lower.includes("column") && lower.includes("does not exist")) ||
		lower.includes("permission denied") ||
		lower.includes("duplicate key") ||
		lower.includes("violates") ||
		lower.includes("canceling statement") ||
		lower.includes("deadlock")
	) {
		return "query";
	}

	if (
		lower.includes("broken pipe") ||
		lower.includes("connection reset") ||
		lower.includes("unexpected eof") ||
		lower.includes("unexpected end of file") ||
		lower.includes("error communicating with the plugin") ||
		lower.includes("error communicating with the application") ||
		lower.includes("ipc") ||
		lower.includes("invoke")
	) {
		return "transport";
	}

	return undefined;
}

function inferSqlState(message: string): string | undefined {
	// Typical: ... (SQLSTATE 42P01)
	const match = message.match(/\(SQLSTATE\s+([0-9A-Z]{5})\)/i);
	return match?.[1];
}

export type NormalizeErrorOptions = {
	/** Hint when the throw site already knows the domain. */
	category?: AppErrorCategory;
};

/**
 * Convert unknown failures into a structured `AppError`.
 */
export function normalizeError(
	error: unknown,
	options: NormalizeErrorOptions = {},
): AppError {
	const raw = messageOf(error);
	const inferred = inferCategoryFromMessage(raw);
	const category = options.category ?? inferred ?? "internal";
	const code = inferSqlState(raw);

	return {
		code,
		category,
		message: raw,
		cause: error,
	};
}

const CONNECTION_HINT =
	"Check host, port, database name, user, password, and network access, then try again.";
const QUERY_HINT =
	"Review the SQL and object names. If it persists, try running a smaller query.";
const TRANSPORT_HINT =
	"The app lost contact with the database or the desktop shell. Retry the action.";
const INTERNAL_HINT = "If this keeps happening, restart VeloxDB and try again.";
const VALIDATION_HINT = "Fix the highlighted fields and try again.";

/**
 * Single user-facing string suitable for inline banners and toast descriptions.
 */
export function toUserMessage(error: AppError): string {
	const base = error.message.trim();
	const hint = (() => {
		switch (error.category) {
			case "connection":
				return CONNECTION_HINT;
			case "query":
				return QUERY_HINT;
			case "transport":
				return TRANSPORT_HINT;
			case "validation":
				return VALIDATION_HINT;
			default:
				return INTERNAL_HINT;
		}
	})();

	if (!base) {
		return hint;
	}

	// Avoid duplicating if backend already included guidance.
	if (base.length > 180) {
		return base;
	}

	return `${base} ${hint}`;
}

/**
 * Short title for toasts by category.
 */
export function toastTitleForCategory(category: AppErrorCategory): string {
	switch (category) {
		case "connection":
			return "Connection failed";
		case "query":
			return "Query failed";
		case "transport":
			return "Communication error";
		case "validation":
			return "Invalid input";
		default:
			return "Something went wrong";
	}
}

/**
 * Map a raw unknown error to a user message in one step.
 */
export function userMessageFromUnknown(
	error: unknown,
	options?: NormalizeErrorOptions,
): string {
	return toUserMessage(normalizeError(error, options));
}

/**
 * Classify using message heuristics when category is unknown (e.g. raw strings).
 */
export function classifyMessage(message: string): AppErrorCategory {
	return inferCategoryFromMessage(message) ?? "internal";
}
