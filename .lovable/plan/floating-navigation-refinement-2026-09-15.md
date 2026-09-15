# Floating navigation refinement

## What will change
- Replace the full-width sticky header bar with a centered floating navigation shell.
- Add comfortable spacing from the viewport edges, a subtle border, soft shadow, and translucent surface for stronger visual separation.
- Refine the logo, active navigation state, language control, and action buttons so they feel cohesive inside the new shell.
- Keep the existing links, bilingual behavior, sticky positioning, and mobile menu functionality unchanged.
- Make the expanded mobile menu visually connect to the floating header rather than spanning the full screen.

## Technical details
- Update the shared site header component using the existing semantic color and shadow tokens.
- Avoid hardcoded colors and preserve the existing design-system controls.
- Verify the homepage at desktop and mobile widths, including menu expansion and horizontal overflow.
