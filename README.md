# Personal Expense Tracker

A private, local-first monthly expense tracker rewritten from the original household expense tracker.

## Features

- Add, edit, and delete expenses with amount, date, category, payment method, and note
- Review spending by month with category totals and a visual breakdown
- Set a monthly budget and see how much remains
- Import and export CSV or JSON ledger data
- Work offline with automatic browser localStorage persistence
- Install as a Progressive Web App on desktop or phone
- Optionally sign in and sync with your own separate Firebase Realtime Database

## Development

```powershell
npm install
npm run dev
npm run lint
npm run build
```

With no Firebase environment values, expense data stays in this browser unless you export it. With Firebase configured, only your approved account can open the ledger. Incomplete configuration shows a setup screen.

## Personal Firebase setup

Use a **new Firebase project** for this app. Do not copy the joint tracker's environment file, database URL, user UIDs, or Firebase project aliases. This folder is the personal app; the joint GitHub repository and database require no changes.

1. In the Firebase console, create your personal project and a **Realtime Database** in locked mode.
2. Enable **Authentication → Sign-in method → Email/Password**. Manually create your account under **Users**, then copy its UID. There is no public registration.
3. Add `kvorsewu1027.github.io` to **Authentication → Settings → Authorized domains**. Add `localhost` if testing sign-in locally.
4. Register a Web app in **Project settings → Your apps**. Copy `.env.example` to `.env.local` in this folder, then fill in the new project's web configuration:

```dotenv
VITE_LEDGER_SYNC_URL=https://YOUR-PERSONAL-DATABASE.firebasedatabase.app/expenseTracker/main
VITE_FIREBASE_API_KEY=YOUR_PERSONAL_PROJECT_WEB_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PERSONAL_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PERSONAL_PROJECT
VITE_FIREBASE_ALLOWED_UIDS=YOUR_PERSONAL_ACCOUNT_UID
```

Use the exact database hostname shown by Firebase (it may include a region or use `firebaseio.com`). Keep `/expenseTracker/main` at the end. Exactly one UID is supported. The same path in a different database holds separate data. Web configuration and UIDs are public identifiers; never provide passwords, service-account keys, or database secrets in these variables. `.env.local` is ignored by Git.

5. In this folder's `database.rules.json`, replace both `REPLACE_WITH_PERSONAL_FIREBASE_UID` placeholders with that same personal account UID. Paste the rules into **the new personal database's Rules tab** and publish them. The rules, not the frontend allowlist, enforce access. Keep the joint database's rules untouched.
6. Restart `npm run dev`, sign in, add a test expense, then verify it after reloading and on another device. Confirm signed-out and other accounts cannot read or write through Firebase's Rules Playground. These live checks require your actual Firebase project.
7. Build again after changing environment values. Deployment must target the separate personal repository and `/personal-finance-tracker/` path.

The app uses a named Firebase app and a browser cache scoped to the personal database URL and account UID. It never reads `ledger-bloom-react-state`, the joint app's cache. Switching from local-only mode to Firebase starts with the new database's ledger; existing local-only entries are not uploaded automatically. Export each required month before switching and combine those files before importing, because each import replaces the ledger.

Sync checks for cloud changes every 10 seconds and saves edits after a short delay. Failed saves remain pending in the browser cache and are retried, including after reloading. Keep using one device at a time: like the original app, saves replace the whole ledger; simultaneous edits on different devices are not merged. Browser cache is not encrypted, so use a trusted browser profile.

Automated sync/configuration checks: `npm test`. Standard checks: `npm run lint` and `npm run build`.

## Data transfer

Use **Settings → Export** to create a month-scoped CSV backup. Importing a CSV or JSON file replaces the current ledger. Common expense headers such as `name`, `amount`, `date`, `category`, `payment`, and `note` are supported, and existing Ledger Bloom JSON exports remain compatible.

## Deployment

The Vite base path is configured for `/personal-finance-tracker/`. Update `homepage` in `package.json` if this project is published under a different GitHub Pages owner or path.
