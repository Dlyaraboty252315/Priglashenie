# Даниял & Гаухар — Үйлену тойы

Wedding invitation site with RSVP form. Guests can choose whether they will attend, select 1 or 2 guests, and enter the name(s).

## Railway setup for collecting responses

In Railway → your website service → Variables, add:

- `RSVP_ADMIN_KEY` = a long private password of your choice (keep it secret)
- `RSVP_DATA_FILE` = `/data/rsvps.json`

Then in Railway → your website service → Settings/Volumes, create a persistent volume mounted at `/data`. Without a persistent volume, responses stored on the app filesystem may be lost when the service redeploys or restarts.

After redeploying:
- Guest RSVP form is at the bottom of the invitation page.
- Private response dashboard: `https://YOUR-DOMAIN/admin`
- The dashboard accepts the `RSVP_ADMIN_KEY` and shows all replies, attendee totals, and a CSV export that opens in Excel.

Do not share the admin key or the `/admin` password with guests. Responses are stored on the server; this version does not send email or Telegram notifications.

## Run locally

Requires Node.js 18+. Run `npm start` from this folder. For local response storage, the app writes to `data/rsvps.json` by default. Set `RSVP_ADMIN_KEY` before using `/admin`.
