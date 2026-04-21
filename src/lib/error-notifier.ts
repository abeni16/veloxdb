import { toast } from "@/components/ui/use-toast";
import {
	normalizeError,
	toastTitleForCategory,
	toUserMessage,
	type NormalizeErrorOptions,
} from "@/lib/app-error";

const recent = new Map<string, number>();
const DEDUP_MS = 2500;

function dedupKey(title: string, description: string) {
	return `${title}\u0000${description}`;
}

function pruneOldEntries(now: number) {
	if (recent.size <= 64) {
		return;
	}
	for (const [key, time] of recent) {
		if (now - time > 10_000) {
			recent.delete(key);
		}
	}
}

export type NotifyErrorOptions = NormalizeErrorOptions & {
	/** Override default title from category */
	title?: string;
	/** Skip deduplication (e.g. distinct operational steps) */
	force?: boolean;
};

/**
 * Show a destructive toast for failures, with short-term deduplication to avoid
 * spam from retries or repeated renders.
 */
export function notifyError(
	error: unknown,
	options: NotifyErrorOptions = {},
): void {
	const normalized = normalizeError(error, options);
	const title =
		options.title ?? toastTitleForCategory(normalized.category);
	const description = toUserMessage(normalized);

	if (!options.force) {
		const key = dedupKey(title, description);
		const now = Date.now();
		const last = recent.get(key);
		if (last !== undefined && now - last < DEDUP_MS) {
			return;
		}
		recent.set(key, now);
		pruneOldEntries(now);
	}

	toast({
		variant: "destructive",
		title,
		description,
	});
}
