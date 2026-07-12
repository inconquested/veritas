# Motion scroll recipe reference

## Core primitives
- `useScroll` for tracking scroll progress with `offset` arrays such as `['start end', 'end start']`.
- `useTransform` for mapping scroll progress to values like opacity, y, scale, and color tokens.
- `useSpring`/`useVelocity` for smoothing and damping nearby motion values.
- `AnimatePresence` for entry/exit transitions and modal success states.

## Recommended implementation patterns
- Keep the animation 2D and scroll-linked with a top-down layout metaphor.
- Use light surfaces, crisp borders, and a single accent color such as `#a3e635`.
- Tie milestone and billing states to progress-driven color changes rather than unrelated decorative motion.

## Notes
- This repo already uses Framer Motion through the shared expandable UI primitives, so the portal animation should stay lightweight and reuse those patterns.
