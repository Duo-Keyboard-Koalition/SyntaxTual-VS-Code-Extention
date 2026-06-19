# Claude Code + VS Code in the Browser (Docker)

A single container running [code-server](https://github.com/coder/code-server)
(full VS Code in your browser) with the [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
CLI pre-installed. Open **http://localhost:8080** — no login page.

Everything runs as a pre-made non-root user **`user`** with **passwordless `sudo`
(admin rights)** and no account password. The editor and terminal have full
access to the container's filesystem.

## Start it

```bash
cd docker
docker compose up -d --build
```

Open **http://localhost:8080**. You're dropped straight into VS Code.

## First-run setup: authenticate Claude

Claude Code needs a signed-in Anthropic account — it can't run unattended without
one. One time only:

1. Open a terminal in VS Code (`` Ctrl+` `` or *Terminal → New Terminal*).
2. Run `claude` and follow the login link to sign in.

The login is saved in `~/.claude` (a persisted volume).

> Prefer an API key? Copy `.env.example` to `.env`, set `ANTHROPIC_API_KEY`, and
> `claude` uses it automatically — no login step.

## The `user` account

- Username **`user`**, non-root, **no password**, **passwordless `sudo`**.
- In any terminal, `sudo apt-get install ...` just works.

## Why only VS Code (not Cursor / Antigravity)

VS Code ships a real **server build** (`code-server`) whose UI is served over HTTP
— that's why it works as a website. Cursor and Antigravity are desktop-only
Electron apps:

- **Cursor** ships no server component at all (no server config, no `cli.js`), so
  it cannot be served as a web app.
- **Antigravity** keeps VS Code's server config, but its `serve-web` still boots
  Chromium and needs a display, so it isn't a clean web server either.

The only way to run those two in a browser is to stream the desktop app (VNC),
which is intentionally not used here.

## Common commands

```bash
docker compose up -d --build           # build & start
docker compose logs -f                 # view logs
docker compose down                    # stop
docker compose exec code-server bash   # shell in as `user`
```

## Security note

code-server runs with `--auth none` (no browser password) for zero-friction local
use. **Do not expose :8080 to the internet as-is.** Put it behind a reverse proxy
with HTTPS and authentication (Caddy/nginx/Cloudflare Tunnel) for remote access.

## Notes

- Base: `ubuntu:24.04` + Node.js 20, git, ripgrep, sudo.
- code-server installed via the official `code-server.dev/install.sh`.
- Claude Code installed via `npm i -g @anthropic-ai/claude-code`.
- Files live in `docker/workspace/` on the host, mounted at `/home/user/project`.
