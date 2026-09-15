# Mobile app (Expo)

During the Vite web cutover, the Expo Router app remains at the **repository root**
(`app/`, `app.config.js`, `eas.json`, etc.) so EAS production deploys are undisturbed.

**Planned:** move Expo into `apps/mobile` once web cutover is stable.

Until then:

```bash
# from repo root
npm install
npm run web          # Expo RN Web (legacy) — http://localhost:8081
npm run ios / android
```

New browser UI lives in `apps/web` (Vite). Do not import `react-native` into Vite.
