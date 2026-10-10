# actual-truelayer-sync

Syncs bank and credit card transactions from [TrueLayer](https://truelayer.com/) into [Actual Budget](https://actualbudget.org/). Runs as a scheduled Docker container.

**Supported banks:** Any UK bank supported by TrueLayer's Open Banking or OAuth connections (Monzo, Starling, Barclays, HSBC, Lloyds, NatWest, Santander, and many more).

---

## Prerequisites

- Docker and Docker Compose
- A self-hosted [Actual Budget](https://actualbudget.org/) instance
- A free [TrueLayer developer account](https://console.truelayer.com/)

---

## TrueLayer Setup

1. Sign up at the [TrueLayer Console](https://console.truelayer.com/).
2. Create a new project and switch it from **Sandbox** to **Live** mode to access real bank data.
3. Under **Redirect URIs**, add a redirect URI. The TrueLayer console provides a convenient one you can use:
   ```
   https://console.truelayer.com/redirect-page
   ```
4. Copy your **Client ID** and **Client Secret** — you'll need them shortly.

---

## Docker Setup

Copy the example files and fill in your values:

```
cp compose.example.yml docker-compose.yml
cp example.env .env
```

Edit `.env` — see the comments in `example.env` for what each variable does.

The key values you need are:

- `ACTUAL_SERVER_URL` — URL of your Actual Budget instance
- `ACTUAL_SERVER_PASSWORD` — your Actual Budget password
- `ACTUAL_SYNC_ID` — found under **Settings → Show advanced settings → ID** in Actual Budget
- `TRUELAYER_CLIENT_ID` and `TRUELAYER_CLIENT_SECRET` — from the TrueLayer Console

---

## Adding Your First Bank Connection

The setup script handles the OAuth flow and writes `config.json` and `state.json` into your data directory interactively.

**Run via Docker (recommended):**

```
docker compose run --rm actual-truelayer-sync npm run setup
```

**Run locally** (requires Node 20+):

```
npm install
npm run dev:setup
```

The script will:

1. Ask whether this is a bank account or credit card connection
2. Build a TrueLayer auth URL for you to open in your browser
3. Ask you to paste back the redirect URL after authenticating
4. Let you select which accounts to add and map them to Actual Budget accounts
5. Write `config.json` and `state.json` to your data directory

Run it again for each additional bank you want to add.

---

## Adding a Connection Manually

If you prefer not to use the setup script, you can do this with curl.

**Step 1 — Authenticate with your bank**

Open this URL in your browser (substituting your Client ID and choosing the appropriate scope):

For bank accounts:

```
https://auth.truelayer.com/?response_type=code&client_id=[CLIENT_ID]&scope=accounts%20balance%20transactions%20offline_access&redirect_uri=https://console.truelayer.com/redirect-page&providers=uk-ob-all%20uk-oauth-all&response_mode=query
```

For credit/charge cards:

```
https://auth.truelayer.com/?response_type=code&client_id=[CLIENT_ID]&scope=cards%20balance%20transactions%20offline_access&redirect_uri=https://console.truelayer.com/redirect-page&providers=uk-ob-all%20uk-oauth-all&response_mode=query
```

After authenticating with your bank, you'll be redirected to a URL containing a `code` query parameter.

**Step 2 — Exchange the code for tokens**

```
curl -X POST https://auth.truelayer.com/connect/token \
  -d grant_type=authorization_code \
  -d client_id=[CLIENT_ID] \
  -d client_secret=[CLIENT_SECRET] \
  -d redirect_uri=https://console.truelayer.com/redirect-page \
  -d code=[CODE]
```

The response contains a `refresh_token`. Add this to `state.json` under the connection name.

**Step 3 — Discover account IDs**

Add a connection to `config.json` with an empty `accounts` array and start the container. The first sync will log all available TrueLayer account IDs for that connection:

```
[My Bank] Unmatched TrueLayer account (not in config):
  └ My Current Account (TRANSACTION) — trueLayerId: abc123...
  └ My Savings Account (SAVINGS)     — trueLayerId: def456...
```

Add the IDs you want to `config.json` along with the corresponding Actual Budget account IDs (found in the URL when viewing an account in Actual Budget), then restart.

---

## Config Reference

Configuration is split across two files in your data directory.

### `config.json`

Defines which accounts to sync and how. See `config.example.json` for a full example.

| Field                    | Required | Description                                                                                                                                                                                                                                                      |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                | Yes      | Must be `2`                                                                                                                                                                                                                                                      |
| `includeCategoryInNotes` | No       | Appends TrueLayer transaction category to the notes field (default: `false`)                                                                                                                                                                                     |
| `lookbackDays`           | No       | How many days back to fetch on first sync for an account (default: `14`). Note: TrueLayer currently appears to ignore the `from` date parameter and returns all available transactions regardless — this field is retained in case TrueLayer honour it in future |
| `connections`            | Yes      | Array of bank connections (see below)                                                                                                                                                                                                                            |

**Connection fields:**

| Field      | Required | Description                                                       |
| ---------- | -------- | ----------------------------------------------------------------- |
| `name`     | Yes      | Unique label, used in logs and to match state                     |
| `isCard`   | No       | Set to `true` if this connection is a credit/charge card provider |
| `accounts` | Yes      | Array of accounts to sync (empty array = ID discovery mode)       |

**Account fields:**

| Field          | Required | Description                                                                                                         |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `trueLayerId`  | Yes      | TrueLayer `account_id` for this account                                                                             |
| `actualId`     | Yes      | Actual Budget account ID                                                                                            |
| `friendlyName` | Yes      | Label used in logs                                                                                                  |
| `flip`         | No       | Inverts transaction amounts. Credit card accounts have amounts flipped automatically; use `flip: false` to override |
| `isCard`       | No       | Overrides the connection-level `isCard` for this specific account                                                   |

### `state.json`

Stores refresh tokens and last sync dates. Written by the app and the setup script — you should not need to edit this manually.

See `state.example.json` for the expected structure.

> **Note:** Both files are excluded from Docker image builds. Mount them via the `./actual-truelayer-sync/data:/app/data` volume in your compose file.

---

## Running

Start the container:

```
docker compose up -d
```

By default the sync runs once on startup and exits. Set `CRON_SCHEDULE` in your `.env` to run on a schedule:

```
CRON_SCHEDULE=0 */4 * * *   # Every 4 hours
```

Set `TZ` to ensure the schedule fires at the expected local time:

```
TZ=Europe/London
```

Each run logs when every connection's bank consent expires (Open Banking consents usually last 90 days). When a consent is within `CONSENT_WARNING_DAYS` (default `7`) of expiring, or has expired, it is logged as an error so you have time to re-authorise the connection with the setup script:

```
CONSENT_WARNING_DAYS=14
```

View logs:

```
docker compose logs -f actual-truelayer-sync
```

---

## Migrating from v1

If you have an existing `config.json` from before the config/state split, see [MIGRATION.md](MIGRATION.md).

---

## Use of AI

This project has made use of AI tooling throughout development:

- **Code review** — reviewing sync logic, error handling, and edge cases; catching bugs and suggesting improvements
- **Test writing** — generating unit tests for config loading, sync logic, and transaction mapping
- **The setup script** — `scripts/setup.ts`, including the OAuth flow, interactive prompts, and file writing logic, was written with AI assistance
- **Documentation** — this README was written with AI assistance

The intent is to be transparent about this. All AI-generated code has been reviewed and tested by the author.

---

## License

MIT
