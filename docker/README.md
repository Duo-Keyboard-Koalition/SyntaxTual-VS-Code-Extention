# Claude Code + VS Code / Cursor / Antigravity in the Browser (Docker)

One container, one URL. Open **http://localhost:8080** and choose:

- **VS Code** — full VS Code in the browser ([code-server](https://github.com/coder/code-server)).
- **Cursor** — the **real** Cursor desktop app, streamed to your browser over noVNC.
- **Antigravity** — Google's Antigravity IDE desktop app, streamed over noVNC.

The [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI is installed
in all of them. Everything runs as a pre-made non-root user **`user`**
(passwordless `sudo`, no account password).

## How it works

```
browser ──▶ :8080 (Caddy)
              ├── /               chooser landing page
              ├── /code/          ─▶ code-server                 (VS Code)
              ├── /cursor/        ─▶ noVNC ─▶ TigerVNC ─▶ Cursor desktop
              └── /antigravity/   ─▶ noVNC ─▶ TigerVNC ─▶ Antigravity desktop
```

A small `supervisord` runs the pieces. Cursor and Antigravity each get their own
X/VNC session so their `/path` always shows that specific app.

## Start it

```bash
cd docker
docker compose up -d --build
```

The first build is large (it downloads a desktop stack + Cursor), so give it a few
minutes. Then open **http://localhost:8080**.

## First-run setup: authenticate Claude

Claude Code needs a signed-in Anthropic account — it can't run unattended without
one. One time only:

1. Open a terminal — in VS Code (`` Ctrl+` ``) or in Cursor.
2. Run `claude` and follow the login link to sign in.

The login is saved in `~/.claude` (a persisted volume).

> Prefer an API key? Copy `.env.example` to `.env`, set `ANTHROPIC_API_KEY`, and
> `claude` uses it automatically — no login step.

## The `user` account

- Username **`user`**, non-root, **no password**, **passwordless `sudo`**.
- In any terminal, `sudo apt-get install ...` just works.

## Why Cursor & Antigravity are streamed (and VS Code isn't)

VS Code ships a browser/server build (`code-server`). Cursor and Antigravity do
not — they're desktop-only Electron apps. So the only way to run the *real* apps
in a browser is to stream their desktop window (TigerVNC → noVNC). That's the
`/cursor/` and `/antigravity/` routes.

## Common commands

```bash
docker compose up -d --build           # build & start
docker compose logs -f                 # view logs
docker compose down                    # stop
docker compose exec code-server bash   # shell in as `user`
```

Per-process logs live inside the container at `/home/user/.log-*.log`
(e.g. `cat ~/.log-cursor.log` to debug Cursor startup).

## Security note

Caddy serves plain HTTP on :8080 with no password — fine for local use. **Do not
expose :8080 to the internet as-is.** Put it behind a reverse proxy with HTTPS and
authentication (Caddy/nginx/Cloudflare Tunnel) for remote access.

## Notes

- Base: `ubuntu:24.04` + Node 20, git, ripgrep, sudo.
- Cursor is installed from the official AppImage (`downloader.cursor.sh`),
  extracted at build time, and launched with `--no-sandbox` (required in a
  container).
- Antigravity is installed from Google's official apt repository
  (`us-central1-apt.pkg.dev`) and launched with `--no-sandbox`.
- `shm_size: 1gb` in compose prevents Chromium/Cursor from crashing on the default
  64 MB `/dev/shm`.
- Files live in `docker/workspace/` on the host, mounted at `/home/user/project`.
