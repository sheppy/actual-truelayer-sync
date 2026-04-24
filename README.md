# Actual TrueLayer Sync

This project is a Node.js application that syncs transaction data from the TrueLayer API to the Actual budgeting app.
It is designed to run as a scheduled task, fetching new transactions and importing them into Actual on a regular basis.

## Setup

You will need:

- Docker and Docker Compose
- A free [TrueLayer](https://truelayer.com/) account
- A self-hosted [Actual Budget](https://actualbudget.org/) instance

---

### TrueLayer Setup

1. Go to the [TrueLayer Console](https://console.truelayer.com/) and sign up for a free developer account.
2. Create a project - ensure you toggle it from "Sandbox" to "Live" mode to access real transaction data.
3. Grab your Client ID and Client Secret.

---

### Docker Setup

You will need the URL to your Actual Budget instance, as well as the password to login. You will also need a syncId,
it's under Settings → Show advanced settings → ID in the current Actual UI.

Copy `compose.example.yml` to `docker-compose.yml` and `example.env` to `.env`, then fill in the required values.

Note there is a `CRON_SCHEDULE` entry that controls how often the sync runs, it uses standard cron syntax.
If this is not set, the sync runs once on startup and then exits. If you want it to run continuously, set a schedule
such as `0 */4 * * *` (every 4 hours).

An optional `TZ` environment variable can be set to ensure the cron schedule fires at the expected local time,
e.g. `TZ=Europe/London`.

---

### Config Setup

Create a `config.json` in your data directory and fill in the required values, see `config.example.json` for examples.

Each **connection** represents a single bank linked via TrueLayer. A connection has:

- `name` — a friendly label used in logs
- `refreshToken` — obtained during the bank linking flow (see [Connecting Banks](#connecting-banks))
- `isCard` — (optional) set to `true` if this connection is a credit card provider (uses TrueLayer's `/cards` endpoint instead of `/accounts`)
- `accounts` — list of accounts to sync. If you leave this as an empty array, it will log out all the available accounts it finds for this connection on the first run, so you can fill in the IDs and restart

Each **account** within a connection has:

- `trueLayerId` — the TrueLayer `account_id` for this account
- `actualId` — the Actual Budget account ID to import transactions into (get from the URL in ActualBudget)
- `friendlyName` — used in logs
- `flip` — (optional) set to `true` to invert transaction amounts (e.g. if debits are appearing as credits). Credit cards with `isCard: true` have amounts flipped automatically; use `flip: false` to override that.
- `isCard` — (optional) overrides the connection-level `isCard` for this specific account

See `config.example.json` for a full example covering all options.

---

## Connecting Banks

Visit this URL (substituting your Client ID) to connect your bank accounts, at the end you should be presented with a code.
```
https://auth.truelayer.com/?response_type=code&client_id=[CLIENT_ID]&scope=info%20accounts%20balance%20transactions%20offline_access&redirect_uri=https://console.truelayer.com/redirect-page&response_mode=query
```

Next you need to exchange this code for a refresh token, you can do this with the following curl command (substituting
your Client ID, Client Secret, and the code you just received):
```
curl -X POST https://auth.truelayer.com/connect/token \
  -d grant_type=authorization_code \
  -d client_id=[CLIENT_ID] \
  -d client_secret=[CLIENT_SECRET] \
  -d redirect_uri=https://console.truelayer.com/redirect-page \
  -d code=[CODE]
```

This will return a JSON response containing an `access_token` and a `refresh_token`. Copy the `refresh_token` and add
it to your `config.json` file for the relevant connection.

---

## Running

Start the container:
```
docker compose up -d
```

On first run, if your `accounts` array is empty (or contains accounts not yet mapped), the sync will log any unmatched
TrueLayer accounts it finds so you can identify the IDs to add to your config:

```
[My Bank] Unmatched TrueLayer account (not in config):
  └ My Current Account (TRANSACTION) — trueLayerId: abc123...
  └ My Savings Account (SAVINGS) — trueLayerId: def456...
```

Copy the relevant `trueLayerId` values into your `config.json`, then restart the container. The next run will begin
importing transactions.
