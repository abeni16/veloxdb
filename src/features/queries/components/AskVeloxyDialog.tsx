import { RobotIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AskVeloxyResponse } from "@/data/types";
import { cn } from "@/lib/utils";

export type AskVeloxySubmitResult = {
	response: AskVeloxyResponse;
	decision: "auto-ran" | "needs-confirmation";
	decisionReason?: string;
	pendingSql?: string;
};

type ChatMessage =
	| { id: string; role: "user"; text: string }
	| {
			id: string;
			role: "assistant";
			text: string;
			result?: AskVeloxyResponse;
			decision?: AskVeloxySubmitResult["decision"];
			decisionReason?: string;
			pendingSql?: string;
	  };

type AskVeloxySidebarProps = {
	isPending: boolean;
	modelLabel: string;
	isConfigured: boolean;
	onClose: () => void;
	onOpenSettings: () => void;
	onSubmit: (naturalPrompt: string) => Promise<AskVeloxySubmitResult>;
	onConfirmRun: (sql: string) => Promise<void>;
	errorMessage: string | null;
};

export function AskVeloxySidebar({
	isPending,
	modelLabel,
	isConfigured,
	onClose,
	onOpenSettings,
	onSubmit,
	onConfirmRun,
	errorMessage,
}: AskVeloxySidebarProps) {
	const [prompt, setPrompt] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	return (
		<div className="flex h-full min-h-0 w-full flex-col bg-background">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<div className="min-w-0">
					<p className="flex items-center gap-1 text-xs font-semibold text-foreground">
						<RobotIcon className="size-3.5" />
						Ask Veloxy
					</p>
					<p className="truncate text-[11px] text-muted-foreground">
						Model: {modelLabel}
					</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="h-7 w-7"
					aria-label="Close Ask Veloxy"
					onClick={onClose}
				>
					<XIcon className="size-3.5" />
				</Button>
			</div>

			<div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 py-2">
				{!isConfigured ? (
					<div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700">
						<p className="font-medium">Configure Veloxy first</p>
						<p className="mt-1">Set your OpenRouter API key and model in Settings → Veloxy.</p>
						<Button
							variant="outline"
							size="sm"
							className="mt-2 h-7 text-xs"
							onClick={onOpenSettings}
						>
							Open Settings
						</Button>
					</div>
				) : null}

				{messages.length === 0 && isConfigured ? (
					<div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
						Ask in natural language, for example: “Find failed payments in the last 7 days”.
					</div>
				) : null}

				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"rounded-md border px-2.5 py-2 text-xs",
							message.role === "user"
								? "ml-10 border-primary/30 bg-primary/5 text-foreground"
								: "mr-10 border-border bg-background text-foreground",
						)}
					>
						<p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
							{message.role === "user" ? "You" : "Veloxy"}
						</p>
						<p className="whitespace-pre-wrap">{message.text}</p>
						{message.result ? (
							<div className="mt-2 rounded border border-border bg-muted/20 px-2 py-1 text-[11px]">
								<p>
									{message.result.intent} · {Math.round(message.result.confidence * 100)}% confidence
								</p>
								<p className="text-muted-foreground">
									Tokens (est): {message.result.tokenStats.promptTokensEstimate}
								</p>
							</div>
						) : null}
						{message.decision === "auto-ran" ? (
							<p className="mt-2 text-[11px] text-emerald-600">Auto-ran safely.</p>
						) : null}
						{message.decision === "needs-confirmation" && message.pendingSql ? (
							<div className="mt-2">
								<p className="mb-1 text-[11px] text-amber-700">
									{message.decisionReason ?? "Needs confirmation before running."}
								</p>
								<Button
									variant="outline"
									size="sm"
									className="h-7 text-xs"
									onClick={() => {
										if (!message.pendingSql) return;
										void onConfirmRun(message.pendingSql);
									}}
								>
									Run query now
								</Button>
							</div>
						) : null}
					</div>
				))}

				{isPending ? (
					<div className="mr-10 rounded-md border border-border bg-background px-2.5 py-2 text-xs">
						<p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Veloxy</p>
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<span className="size-1.5 animate-pulse rounded-full bg-current" />
							<span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
							<span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
							<span>Thinking...</span>
						</div>
					</div>
				) : null}

				{errorMessage ? (
					<div className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
						{errorMessage}
					</div>
				) : null}
			</div>

			<div className="border-t border-border p-2">
				<Textarea
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					placeholder="Ask Veloxy to write SQL..."
					className="min-h-16"
					disabled={!isConfigured || isPending}
				/>
				<div className="mt-2 flex justify-end">
					<Button
						variant="default"
						size="sm"
						disabled={!isConfigured || isPending || prompt.trim().length === 0}
						onClick={async () => {
							const naturalPrompt = prompt.trim();
							if (!naturalPrompt) return;
							setMessages((prev) => [
								...prev,
								{ id: crypto.randomUUID(), role: "user", text: naturalPrompt },
							]);
							setPrompt("");
							try {
								const result = await onSubmit(naturalPrompt);
								setMessages((prev) => [
									...prev,
									{
										id: crypto.randomUUID(),
										role: "assistant",
										text: result.response.sql,
										result: result.response,
										decision: result.decision,
										decisionReason: result.decisionReason,
										pendingSql: result.pendingSql,
									},
								]);
							} catch {
								// parent already sets surfaced error message.
							}
						}}
					>
						Send
					</Button>
				</div>
			</div>
		</div>
	);
}
