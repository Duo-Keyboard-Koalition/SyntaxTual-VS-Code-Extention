# VS Code in the browser (code-server) + Claude Code CLI.
# Served as a website on :8080. Runs as a pre-made non-root `user` with
# passwordless sudo (admin rights) and no password.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8

# --- Base tooling + Node.js 20 (required by Claude Code) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates git sudo ripgrep locales \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# --- code-server (browser VS Code) + Claude Code CLI ---
RUN curl -fsSL https://code-server.dev/install.sh | sh \
    && npm install -g @anthropic-ai/claude-code

# --- Pre-made non-root user `user`: no password, passwordless sudo (admin) ---
RUN useradd --create-home --shell /bin/bash user \
    && passwd --delete user \
    && echo 'user ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/user \
    && chmod 0440 /etc/sudoers.d/user \
    && mkdir -p /home/user/project /home/user/.claude /home/user/.config \
    && chown -R user:user /home/user

COPY welcome.txt /etc/claude-welcome
# Show the welcome banner and provide a danger-mode alias in every terminal.
# Danger mode (--dangerously-skip-permissions) only works because `user` is non-root.
RUN printf '%s\n' \
        'cat /etc/claude-welcome' \
        "alias claude-danger='claude --dangerously-skip-permissions'" \
        >> /home/user/.bashrc \
    && chown user:user /home/user/.bashrc

USER user
WORKDIR /home/user/project

EXPOSE 8080

# code-server serves VS Code on 0.0.0.0:8080 with no login page (--auth none).
ENTRYPOINT ["code-server", "--auth", "none", "--bind-addr", "0.0.0.0:8080", "/home/user/project"]
