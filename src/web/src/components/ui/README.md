# UI primitives

Place reusable, accessible design-system primitives here. Keep product-specific components inside their feature folder instead of growing a generic component catalogue.

## Shared visual rules

- Use `SummarySurface` for module headers and summary areas.
- Use `AnimatedDropdown` and `AnimatedDatePicker` for consistent form controls.
- Primary actions use the navy gradient; secondary actions use a white surface with a slate border; destructive actions use red only when the action can remove data.
- Keep motion short and functional. Shared focus, hover, press, dialog, table, and summary-card behavior is defined in `src/styles/index.css` under `.app-shell`.

