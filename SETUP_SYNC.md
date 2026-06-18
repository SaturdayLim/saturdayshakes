# Cross-device sync — setup (~5 minutes, one time)

Your app works on its own (recipes save in the browser). These steps add a tiny shared
backend so recipes you add on **any** device show up on **all** of them.

## What's in the repo
- `index.html` – the app (serves at `/`)
- `vercel.json` – static config + image caching
- `api/data.js` – the sync function (no dependencies, no build step)
- `images/` – recipe photos

## 1. Push the repo
```bash
git add -A
git commit -m "Add index.html, vercel.json, and sync API"
git push
```
Vercel auto-deploys. The homepage now loads at https://saturdayshakes.vercel.app/

## 2. Add a database (Upstash Redis — free)
In the Vercel dashboard → your **saturdayshakes** project → **Storage** tab →
**Create / Connect Store** → choose **Upstash → Redis** → create & connect it to the project.

This automatically adds two environment variables to the project:
`KV_REST_API_URL` and `KV_REST_API_TOKEN`. (You don't have to copy anything.)

## 3. Set your password
Vercel → project → **Settings → Environment Variables** → add:

| Name | Value | Environments |
|------|-------|--------------|
| `APP_PASSWORD` | *a secret you choose* | Production (and Preview) |

This password is required to **save** changes. Reading the page is open.

## 4. Redeploy
Vercel → **Deployments** → latest → **⋯ → Redeploy** (so the function picks up the new
variables). Or just `git push` an empty commit.

## 5. Turn it on
- Open the site. A **☁ Sign in to sync** button appears in the toolbar (top right).
- Click it, enter your `APP_PASSWORD`. Your whole collection uploads. The button reads **☁ Synced**.
- On every other device/browser: open the site — it loads the shared collection automatically.
  To add or edit there too, click the cloud button once and enter the same password.

## Good to know
- **Adds/edits/deletes sync automatically** a moment after you make them (button shows "Syncing…").
- **Last write wins**: if two devices save at the same moment, the most recent one wins. Fine for personal use.
- **No backend yet?** The app still works fully — it just keeps data in that one browser, and the cloud button stays hidden until storage is connected.
- **Photos**: small uploaded photos sync as part of the collection. The ~89 seeded photos live in `images/` and load from the site.
