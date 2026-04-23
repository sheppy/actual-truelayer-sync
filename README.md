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

Check `compose.example.yml` and `example.env` for the full list of required environment variables.

Note there is a `CRON_SCHEDULE` entry that controls how often the sync runs, it uses standard cron syntax.
If this is not set, it will on startup - but not run on a schedule.

---

### Config Setup

There is an example config file at `config.example.json`. Copy this and fill in the required values.

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

Once the connections are in place, if you run the sync with will fetch the accounts and list out the trueLayerIds so
that you can add those to the config as well. Running after that will start importing transactions.