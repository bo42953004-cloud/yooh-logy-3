# Deploying AI Code Studio

The app is a standard Next.js 16 project. It needs no configuration files for Vercel. A PostgreSQL
database is optional: without one the studio and spreadsheet work, and only saving and loading are off.

## Who can use it

The app has no accounts and no login. Anyone who can open its address can use the studio and the
spreadsheet, and can see, change or delete every saved project and sheet.

## Vercel

1. Put the project in a GitHub, GitLab or Bitbucket repository. `.gitignore` already keeps `.env`,
   `node_modules` and build output out of it.
2. In Vercel choose **Add New → Project** and import the repository. Vercel detects Next.js; leave the
   build settings as they are.
3. Deploy. The site is live at this point, with saving switched off.
4. To switch saving on, open the project's **Storage** tab, create a **Neon** (Postgres) database and
   connect it to the project. Vercel adds the database address to the project by itself.
5. Redeploy (**Deployments → ⋯ → Redeploy**) so the new setting is picked up.
6. Open `https://<your-app>.vercel.app/api/health`. It should show `{"ok":true,"database":"connected"}`.

The tables are created automatically on the first request. There is no migration step.

### Using your own database instead

Add one environment variable under **Settings → Environment Variables**, then redeploy:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

The app reads the first of these that is set: `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`,
`DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`. If you gave the Vercel integration a custom prefix
(for example `MYDB_DATABASE_URL`), add a plain `DATABASE_URL` with the same value.

Use the pooled address when your provider offers one. Serverless hosts open many short connections.

### Encryption

Connections to any database that is not on the same machine are encrypted. By default the database's
certificate is not checked, which is what `sslmode=require` means in PostgreSQL and what most hosted
databases need. To check the certificate as well, put `sslmode=verify-full` in the address or set
`DATABASE_SSL=verify`. `DATABASE_SSL=false` turns encryption off.

### Limits on Vercel

- Vercel stops a function after its time limit. One writer or website request streams for at most
  45 seconds, so very slow speed settings are quickened to fit. The non-stop writer is unaffected,
  because it sends a new request for every burst.
- A saved project can hold about 1.4 MB of code, under Vercel's 4.5 MB request limit.

### Messages in the Vercel build log

Upload `package-lock.json` together with the project. With it, Vercel installs exactly the package
versions this app was tested with.

These lines can appear during the install step. They are notices, not errors, and the build continues:

| Line | Where it comes from |
| --- | --- |
| `Unknown env config "cache-dir"` | A setting on Vercel's own build machine. Nothing in this project sets it. |
| `deprecated @esbuild-kit/esm-loader` and `@esbuild-kit/core-utils` | Parts of `drizzle-kit`, the database command-line tool. The site does not use them. |
| `deprecated eslint@9` | Only when `package-lock.json` is missing. ESLint is the code checker and is not part of the build. |

The `allowScripts` entry in `package.json` approves the install scripts of `esbuild` and `unrs-resolver`,
which newer npm versions otherwise warn about and will later block.

## Other Node hosts (Render, Railway, Fly, a VPS)

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `DATABASE_URL=postgresql://...`
- Health check path: `/api/health`
- Node.js **20.9 or newer**.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| The home page says "Database not connected" | No database address is set | Connect a database (step 4) or add `DATABASE_URL`, then redeploy. |
| `/api/health` shows `"database":"missing"` | Same as above | Same as above. |
| "The database did not answer in time" | Wrong host, a paused database, or a firewall | Check the address. Resume the database in your provider's dashboard. |
| "The database rejected the username or password" | Wrong credentials in the address | Copy the address again from your provider. |
| "The database's security certificate was not accepted" | Certificate checking is on for a database with a private certificate | Remove `sslmode=verify-full` / `DATABASE_SSL=verify`. |
| Saving still fails after adding the database | The deployment was built before the setting existed | Redeploy. |
| Build fails with a Node version error | Node older than 20.9 | In Vercel: **Settings → Build and Deployment → Node.js Version**, pick 22.x. |

## VS Code extension

The `vscode-extension/` folder is not part of the web deployment. After deploying, set
`aiStudio.serverUrl` in VS Code to your public URL (for example `https://your-app.vercel.app`).

## Backup of the paid version

`backups/paid-version-source.tar.gz` holds the source of the earlier version with accounts, the payment
gate, referrals and the admin portal. It is not used by the app. See `backups/README.md`.
