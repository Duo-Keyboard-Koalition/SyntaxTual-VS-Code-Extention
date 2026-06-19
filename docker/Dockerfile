# Browser entry on :8080 → chooser → VS Code (/code), Cursor (/cursor), Antigravity (/antigravity)
# + Claude Code CLI. Everything runs as a pre-made non-root `user` (passwordless sudo).
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8

# --- Base tooling, Node 20, desktop + VNC stack, Electron/Chromium runtime libs ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg git sudo ripgrep locales supervisor \
        # X / VNC / browser-streaming
        tigervnc-standalone-server tigervnc-common \
        novnc websockify openbox tint2 dbus-x11 xterm x11-utils \
        # Electron (Cursor / Antigravity) runtime libraries
        libgtk-3-0t64 libnss3 libasound2t64 libgbm1 libxshmfence1 \
        libxtst6 libsecret-1-0 libnotify4 libatspi2.0-0t64 libdrm2 \
        libxcomposite1 libxdamage1 libxrandr2 libxfixes3 libxkbfile1 \
        libcups2t64 fonts-liberation xdg-utils \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# --- code-server (browser VS Code), Claude Code CLI, Caddy (reverse proxy) ---
RUN curl -fsSL https://code-server.dev/install.sh | sh \
    && npm install -g @anthropic-ai/claude-code \
    && curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/local/bin/caddy \
    && chmod +x /usr/local/bin/caddy

# --- Antigravity (Google) via its official apt repository ---
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg \
        | gpg --dearmor -o /etc/apt/keyrings/antigravity-repo-key.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" \
        > /etc/apt/sources.list.d/antigravity.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends antigravity \
    && rm -rf /var/lib/apt/lists/*

# --- Cursor: official AppImage, extracted at build time (no FUSE needed) ---
RUN curl -fsSL "https://downloader.cursor.sh/linux/appImage/x64" -o /tmp/cursor.AppImage \
    && chmod +x /tmp/cursor.AppImage \
    && cd /opt && /tmp/cursor.AppImage --appimage-extract \
    && mv /opt/squashfs-root /opt/cursor \
    && rm -f /tmp/cursor.AppImage \
    && ln -sf /opt/cursor/AppRun /usr/local/bin/cursor

# --- Pre-made non-root user `user`: no password, passwordless sudo ---
RUN useradd --create-home --shell /bin/bash user \
    && passwd --delete user \
    && echo 'user ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/user \
    && chmod 0440 /etc/sudoers.d/user \
    && mkdir -p /home/user/project /home/user/.claude /home/user/.config /home/user/.vnc \
    && chown -R user:user /home/user

# --- Config & helper files ---
COPY landing/         /opt/landing/
COPY Caddyfile        /etc/caddy/Caddyfile
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start-vnc.sh     /usr/local/bin/start-vnc.sh
COPY start-app.sh     /usr/local/bin/start-app.sh
COPY welcome.txt      /etc/claude-welcome
RUN chmod +x /usr/local/bin/start-vnc.sh /usr/local/bin/start-app.sh \
    && echo 'cat /etc/claude-welcome' >> /home/user/.bashrc \
    && chown -R user:user /home/user

USER user
WORKDIR /home/user/project

EXPOSE 8080
ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
