# UI primitives

Place reusable, accessible design-system primitives here. Keep product-specific components inside their feature folder instead of growing a generic component catalogue.

## Shared visual rules

- Use `SummarySurface` for module headers and summary areas.
- Use `AnimatedDropdown` and `AnimatedDatePicker` for consistent form controls.
- Use `Button` and `IconButton` instead of repeating action styles. Primary actions use the navy gradient, secondary actions use a white surface with a slate border, ghost actions stay quiet, and destructive actions use red only when an operation removes or voids data.
- Keep one primary action per surface. Use `medium` buttons for normal actions, `small` for dense toolbars, and icon buttons only when the icon has an unambiguous accessible label.
- Keep motion short and functional. Shared focus, hover, press, dialog, table, and summary-card behavior is defined in `src/styles/index.css` under `.app-shell`.
- Menus and dialogs must close with Escape, and menus must also close when the user clicks outside them.

