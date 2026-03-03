# Mobile App (`apps/mobile`)

Expo React Native app for ProdAI.

## Commands

```bash
npm run dev --workspace=mobile
npm run ios --workspace=mobile
npm run android --workspace=mobile
npm run web --workspace=mobile
npm run lint --workspace=mobile
npm run typecheck --workspace=mobile
```

## Notes

- Keep shared business logic in `packages/*` so web and mobile can both consume it.
- Keep this workspace focused on mobile presentation and mobile-specific interactions.
