import { Button } from "@/components/ui/button";

type ColumnVisibilityItem = {
	id: string;
	label: string;
	visible: boolean;
	canHide: boolean;
};

type ResultsToolbarProps = {
	columns: ColumnVisibilityItem[];
	canEdit: boolean;
	isDirty: boolean;
	isBusy: boolean;
	onToggleColumn: (columnId: string, visible: boolean) => void;
	onRefresh: () => void;
	onCopy: () => void;
	onDownloadCsv: () => void;
	onDownloadJson: () => void;
	onSave: () => void;
	/** When set, show “Add row” for direct INSERT into the selected table. */
	onAddRow?: () => void;
	/** Shown when the inline insert row is visible. */
	insertRowVisible?: boolean;
	onInsertRow?: () => void;
	onCancelInsert?: () => void;
	insertBusy?: boolean;
	insertDisabled?: boolean;
};

export function ResultsToolbar({
	columns,
	canEdit,
	isDirty,
	isBusy,
	onToggleColumn,
	onRefresh,
	onCopy,
	onDownloadCsv,
	onDownloadJson,
	onSave,
	onAddRow,
	insertRowVisible,
	onInsertRow,
	onCancelInsert,
	insertBusy,
	insertDisabled,
}: ResultsToolbarProps) {
	return (
		<div className="min-w-0 overflow-x-auto border-b border-border bg-muted/20 px-3 py-2">
			<div className="flex min-w-full w-max items-center justify-between gap-3">
				<div className="flex shrink-0 items-center gap-2">
					{onAddRow ? (
						<Button
							variant="outline"
							size="xs"
							onClick={onAddRow}
							disabled={isBusy}
						>
							Add row
						</Button>
					) : null}
					{insertRowVisible && onInsertRow ? (
						<>
							<Button
								variant="default"
								size="xs"
								onClick={onInsertRow}
								disabled={isBusy || insertBusy || insertDisabled}
							>
								{insertBusy ? "Inserting…" : "Insert"}
							</Button>
							{onCancelInsert ? (
								<Button
									variant="outline"
									size="xs"
									onClick={onCancelInsert}
									disabled={isBusy || insertBusy}
								>
									Cancel insert
								</Button>
							) : null}
						</>
					) : null}
					<Button
						variant="outline"
						size="xs"
						onClick={onRefresh}
						disabled={isBusy}
					>
						Refresh
					</Button>
					<Button variant="outline" size="xs" onClick={onCopy}>
						Copy
					</Button>
					<Button variant="outline" size="xs" onClick={onDownloadCsv}>
						Download CSV
					</Button>
					<Button variant="outline" size="xs" onClick={onDownloadJson}>
						Download JSON
					</Button>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<details className="relative shrink-0">
						<summary className="list-none">
							<Button variant="outline" size="xs" asChild>
								<span>Columns</span>
							</Button>
						</summary>
						<div className="absolute right-0 z-10 mt-1 min-w-44 border border-border bg-background p-2 shadow-sm">
							<div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
								Visibility
							</div>
							<div className="max-h-48 space-y-1 overflow-auto">
								{columns.map((column) => (
									<label
										key={column.id}
										className="flex cursor-pointer items-center gap-2 text-xs text-foreground"
									>
										<input
											type="checkbox"
											className="size-3.5 cursor-pointer"
											checked={column.visible}
											disabled={!column.canHide}
											onChange={(event) =>
												onToggleColumn(column.id, event.target.checked)
											}
										/>
										<span className="truncate">{column.label}</span>
									</label>
								))}
							</div>
						</div>
					</details>

					<Button
						size="xs"
						onClick={onSave}
						disabled={isBusy || !canEdit || !isDirty}
						variant={isDirty ? "default" : "outline"}
					>
						{isBusy ? "Saving..." : "Save"}
					</Button>
				</div>
			</div>
		</div>
	);
}
