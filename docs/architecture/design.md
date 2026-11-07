# HIVE — UI Design & Style Guide

Product: HIVE\
Category: Desktop Developer Assistant\
Technology: Rust, Tauri 2, React\
Design Direction: Modern, Minimal, Dark Developer Tool

## 1. Brand identity

HIVE is a developer-focused personal assistant. Its visual identity should communicate:

- Intelligence and productivity.
- Technical sophistication.
- Reliability and simplicity.
- A modern developer-tool aesthetic.

The design should feel like a polished desktop application, not a generic SaaS dashboard.

Logo: Use the HIVE honeycomb symbol consisting of three connected hexagonal cells. The symbol uses yellow, with one filled cell and two outlined cells. The wordmark uses uppercase, widely spaced white lettering.

## 2. Colour palette

The primary visual identity is built around golden yellow and dark charcoal.

| Colour           | Hex       | Usage                              |
| ---------------- | --------- | ---------------------------------- |
| Primary yellow   | `#FFC400` | Brand, primary actions, highlights |
| Yellow hover     | `#FFD02E` | Hover states                       |
| Deep charcoal    | `#0D0E11` | Main application background        |
| Dark charcoal    | `#151619` | Secondary backgrounds              |
| Card background  | `#141518` | Cards and panels                   |
| Input background | `#191A1E` | Form fields                        |
| Elevated surface | `#222329` | Hovered elements                   |
| Primary text     | `#F5F5F5` | Headings and important text        |
| Secondary text   | `#A1A1AA` | Supporting information             |
| Muted text       | `#71717A` | Hints and descriptions             |
| Border           | `#303137` | Card and input borders             |

Yellow should be used selectively. It is the brand accent, not the dominant background colour.

## 3. Overall visual language

The interface should follow these principles:

Dark by default

- Use charcoal backgrounds rather than pure black.
- Maintain subtle differences between background layers.
- Avoid large areas of bright colour.

Minimal and functional

- Avoid unnecessary decorative elements.
- Give content enough breathing room.
- Prefer clean layouts over excessive card-based designs.
- Avoid visual clutter and unnecessary gradients.

Subtle depth

- Use low-contrast borders.
- Apply restrained shadows to elevated surfaces.
- Use subtle yellow glow effects only for important interactions.
- Avoid excessive glassmorphism and neon effects.

## 4. Typography

Use Inter as the primary typeface.

Typography should be clean, professional and easy to read.

| Element         | Recommended style |
| --------------- | ----------------- |
| Page heading    | 26–32px, semibold |
| Section heading | 18–22px, semibold |
| Card heading    | 15–17px, medium   |
| Body text       | 14px, regular     |
| Supporting text | 12–13px, regular  |
| Button text     | 14–15px, semibold |
| Input text      | 14–16px, regular  |

Use uppercase and letter spacing selectively for branding, not regular interface content.

## 5. Components

Buttons

- Primary buttons use golden yellow with dark text.
- Secondary buttons use dark backgrounds with subtle borders.
- Destructive actions should use restrained red.
- Hover and active states should be clearly distinguishable.
- Avoid excessive rounding.

Input fields

- Dark charcoal background.
- Subtle grey border.
- Light text.
- Muted placeholder text.
- Yellow border or subtle yellow focus ring when active.
- Consistent heights and spacing.

Cards and panels

- Slightly lighter than the main background.
- Subtle borders.
- Rounded corners, generally 10–16px.
- Avoid excessive shadows.

Icons

- Prefer simple, clean outline icons.
- Use consistent stroke weights.
- Use yellow only for selected, active or important states.
- Avoid mixing different icon styles.

## 6. Layout and spacing

The interface should feel spacious without wasting screen real estate.

- Use consistent spacing throughout the application.
- Prefer 8px-based spacing increments.
- Keep related elements visually grouped.
- Use clear visual hierarchy.
- Avoid excessive nested containers.
- Keep desktop layouts responsive to different window sizes.

## 7. Interaction and feedback

Interactions should feel immediate and predictable.

- Use subtle transitions, generally 150–200ms.
- Provide clear hover and focus states.
- Show loading indicators for asynchronous operations.
- Use consistent success, warning and error feedback.
- Avoid distracting animations.
- Keyboard navigation and shortcuts should be first-class considerations.

## 8. Background treatments

The login screen establishes the visual direction for the application.

Its defining characteristics are:

- Near-black charcoal background.
- Large, subtle honeycomb shapes used as decorative elements.
- Restrained golden yellow highlights.
- Soft lighting around selected elements.
- Minimal visual noise.

These treatments can be reused selectively in onboarding, empty states and other brand-oriented screens. Regular workspace screens should be more restrained.

## 9. Design principles to avoid

Do not use:

- Excessive gradients.
- Bright neon colours.
- Cartoonish illustrations.
- Excessive glassmorphism.
- Too many nested cards.
- Large decorative icons.
- Unnecessary borders around every element.
- Overly rounded buttons and containers.
- Inconsistent spacing or typography.
- Yellow backgrounds for large interface sections.

## 10. Overall design direction

HIVE should look like a professional developer utility with the visual polish of a premium desktop product.

Think of a combination of:

- The simplicity of Linear.
- The technical character of developer tools.
- The restrained dark interface of modern IDEs.
- A distinctive yellow-and-charcoal brand identity.

The golden rule: The interface should get out of the developer's way. HIVE is an assistant, not a dashboard competing for attention.

Implementation note: Treat this document as the design authority for all future HIVE screens. New components and pages should follow these guidelines unless there is a deliberate reason to introduce a variation.
