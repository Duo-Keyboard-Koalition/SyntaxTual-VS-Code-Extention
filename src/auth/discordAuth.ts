import * as vscode from 'vscode';

export interface DiscordUser {
    id: string;
    username: string;
    avatar: string | null;
    email?: string;
}

export class DiscordAuthService {
    private static readonly CLIENT_ID = '924666357050654790';
    private static readonly SCOPES = ['identify'];

    private _user: DiscordUser | null = null;
    private _onAuthStatusChanged = new vscode.EventEmitter<DiscordUser | null>();
    public readonly onAuthStatusChanged = this._onAuthStatusChanged.event;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Load saved user
        this._user = this.context.globalState.get<DiscordUser>('discordUser') || null;

        // Register URI handler for OAuth callback
        context.subscriptions.push(
            vscode.window.registerUriHandler({
                handleUri: (uri) => this._handleCallback(uri)
            })
        );
    }

    get user(): DiscordUser | null {
        return this._user;
    }

    get isLoggedIn(): boolean {
        return this._user !== null;
    }

    async login(): Promise<void> {
        // Generate state for CSRF protection
        const state = this._generateState();
        await this.context.globalState.update('oauth_state', state);

        // Build OAuth URL
        // VS Code extension callback format: vscode://publisher.extension/callback
        const redirectUri = `${vscode.env.uriScheme}://syntaxtual.syntaxtual/callback`;

        const authUrl = new URL('https://discord.com/api/oauth2/authorize');
        authUrl.searchParams.set('client_id', DiscordAuthService.CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('scope', DiscordAuthService.SCOPES.join(' '));
        authUrl.searchParams.set('state', state);

        // Open browser for authentication
        await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));

        vscode.window.showInformationMessage(
            'Opening Discord login in your browser. Please authorize the app.'
        );
    }

    async logout(): Promise<void> {
        this._user = null;
        await this.context.globalState.update('discordUser', undefined);
        await this.context.secrets.delete('discord_token');
        this._onAuthStatusChanged.fire(null);
        vscode.window.showInformationMessage('Logged out from Discord');
    }

    private async _handleCallback(uri: vscode.Uri): Promise<void> {
        // Parse the fragment (Discord uses implicit flow, token in fragment)
        const fragment = uri.fragment;
        const params = new URLSearchParams(fragment);

        const accessToken = params.get('access_token');
        const state = params.get('state');

        // Verify state
        const savedState = this.context.globalState.get('oauth_state');
        if (state !== savedState) {
            vscode.window.showErrorMessage('Discord authentication failed: Invalid state');
            return;
        }

        if (!accessToken) {
            // Check for error
            const error = params.get('error');
            if (error) {
                vscode.window.showErrorMessage(`Discord authentication failed: ${error}`);
            } else {
                vscode.window.showErrorMessage('Discord authentication failed: No access token received');
            }
            return;
        }

        try {
            // Fetch user data
            const user = await this._fetchUserData(accessToken);

            if (user) {
                this._user = user;
                await this.context.globalState.update('discordUser', user);
                await this.context.secrets.store('discord_token', accessToken);
                this._onAuthStatusChanged.fire(user);
                vscode.window.showInformationMessage(`Logged in as ${user.username}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Discord authentication failed: ${(error as Error).message}`);
        }
    }

    private async _fetchUserData(accessToken: string): Promise<DiscordUser | null> {
        try {
            const response = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json() as any;

            return {
                id: data.id,
                username: data.username,
                avatar: data.avatar
                    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
                    : null,
                email: data.email
            };
        } catch (error) {
            console.error('Error fetching Discord user:', error);
            return null;
        }
    }

    private _generateState(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}
