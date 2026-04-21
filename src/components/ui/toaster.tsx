"use client";

import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import { TOAST_DURATION_MS, useToast } from "@/components/ui/use-toast";

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider
			label="Notifications"
			duration={TOAST_DURATION_MS}
			swipeDirection="right"
		>
			{toasts.map(({ id, title, description, action, ...props }) => (
				<Toast key={id} {...props}>
					<div className="grid gap-1">
						{title ? <ToastTitle>{title}</ToastTitle> : null}
						{description ? (
							<ToastDescription>{description}</ToastDescription>
						) : null}
					</div>
					{action}
					<ToastClose />
				</Toast>
			))}
			<ToastViewport />
		</ToastProvider>
	);
}
