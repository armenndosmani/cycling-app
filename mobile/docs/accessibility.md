# Text and accessibility conventions

Decisions (see `docs/decisions.md`): English only at launch, all app text in translation files from day one; accessibility target WCAG 2.2 AA. Every new screen follows the rules below. Reviewers check them.

## Text lives in translation files

- All user-facing text comes from `src/i18n/en.json`, never from string literals in components. This includes screen-reader labels and hints, placeholders, header titles, alerts and error messages.
- Use `const { t } = useTranslation()` from `react-i18next` in components. Outside React (e.g. in a helper that builds an alert), import the instance: `import i18n from '@/i18n'` and call `i18n.t(...)`.
- Keys are nested by screen or feature (`status.title`, `errors.network`). Shared words go under `common`. Keys are typed: `npx tsc --noEmit` fails on a key that is not in `en.json`.
- Use interpolation for values (`t('status.serverAddress', { url })`), never string concatenation, so word order can change in other languages.
- Error types and API codes are mapped to keys in the app (`errors.<kind>`). Never show backend messages or exception text to users.
- Adding a language later: add `src/i18n/<lang>.json` with the same keys and register it in `src/i18n/index.ts`.

## Screen readers

- Every interactive element has `accessibilityRole` (`button`, `link`, `checkbox`, ...) and an accessible name: its visible text, or `accessibilityLabel` when there is no visible text (icon buttons). Add `accessibilityHint` when the result of the action is not obvious.
- Use `accessibilityState` for `disabled`, `busy`, `checked` and `selected`.
- Every text input has an `accessibilityLabel` (a placeholder is not a label). Errors for an input are shown as text near it and announced (`accessibilityLiveRegion="polite"` on Android, `AccessibilityInfo.announceForAccessibility` where needed).
- Screen titles use `accessibilityRole="header"`.
- Content that updates by itself (loading results, status) sits in a container with `accessibilityLiveRegion="polite"`.
- Purely decorative views (dots, dividers, background images) are hidden from screen readers (`accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`).
- Use `src/components/Button.tsx` for buttons; it sets role, state and size.

## Text size

- Support dynamic type: never set `allowFontScaling={false}` and never set `maxFontSizeMultiplier` below 2 without a reason written in the code.
- Layouts must survive 200 % text: avoid fixed heights on text containers (use `minHeight`), let text wrap, and put long screens in a `ScrollView`.

## Touch targets

- Anything tappable is at least 44 x 44 pt (`MIN_TOUCH_TARGET` in `src/constants/theme.ts`). For small icons, use `hitSlop` or padding to reach the size.
- Keep at least 8 pt between adjacent targets.

## Colour and contrast

- The app is dark only. Use the colours from `src/constants/theme.ts`; don't add one-off hex values in screens.
- Text contrast is at least 4.5:1 (3:1 for large text 24 px+ or 19 px+ bold, icons and input borders). The theme colours meet this on `background` and `surface`:

  | Foreground             | on `background` | on `surface` |
  | ---------------------- | --------------- | ------------ |
  | `text`                 | ~16:1           | ~15:1        |
  | `textMuted`            | ~7:1            | ~6.5:1       |
  | `accent`               | ~6:1            | ~5.5:1       |
  | `danger`               | ~5.3:1          | ~4.8:1       |
  | `onAccent` on `accent` | ~6:1            |              |

  When adding a colour, check its contrast (e.g. WebAIM contrast checker) and add it to this table.

- `border` (about 1.4:1) is for decorative dividers only. The boundary of an input, checkbox or other control needs 3:1, so use `textMuted` (or `accent` when focused or checked) for it.

- Never use colour alone to carry meaning. A status dot comes with a status word, an error comes with an error text, a selected chip also changes its label state (`accessibilityState={{ selected: true }}`) and shape or icon.

## Before opening a PR

- Try new screens with VoiceOver (iOS) or TalkBack (Android) once: every element is reachable, named and in a sensible order.
- Try the largest system text size: nothing is cut off or overlaps.
