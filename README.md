# Syntaxtual VS Code Extension

AI-powered repository-level code analysis with conversational reviews. Get intelligent code insights, discuss issues with AI, and apply fixes directly in VS Code.

## Features

- 🔍 **Repository-wide Analysis** - Scan entire projects for code issues
- 💬 **Conversational Reviews** - Discuss code problems with AI assistance
- 🎯 **Smart Suggestions** - Get context-aware fixes and improvements
- 🔧 **Auto-fix** - Apply AI-suggested fixes directly to your code
- 🌐 **Flexible AI Backend** - Use OpenAI, local LLMs, or custom endpoints
- 🔐 **Discord Authentication** - Team collaboration features

## Prerequisites

- **Node.js** 18.x or higher
- **VS Code** 1.85.0 or higher
- **API Key** for your chosen AI service (OpenAI, Claude, etc.) or local LLM setup

## Installation

### For Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Duo-Keyboard-Koalition/SyntaxTual-VS-Code-Extention.git
   cd SyntaxTual-VS-Code-Extention
   ```

2. **Install dependencies**
   ```bash
   # Install main extension dependencies
   npm install

   # Install webview dependencies
   cd webview
   npm install
   cd ..
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

## Running the Extension

### Method 1: Debug Mode (Recommended for Development)

1. **Open the project in VS Code**
   ```bash
   code .
   ```

2. **Press F5** or go to **Run and Debug** (Ctrl+Shift+D) and click **"Run Extension"**

3. A new VS Code window will open with the extension loaded

### Method 2: Build and Install Locally

1. **Build the extension package**
   ```bash
   npm run build
   ```

2. **Install in VS Code**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click the `...` menu → "Install from VSIX..."
   - Select the generated `.vsix` file (if packaged)

## Configuration

After launching the extension, configure it in VS Code Settings (Ctrl+,):

### Required Settings

1. **API Key**
   - Search for: `Syntaxtual: Openai Api Key`
   - Enter your API key from OpenAI or your chosen provider

2. **Model Name**
   - Search for: `Syntaxtual: Model`
   - Default: `gpt-4-turbo-preview`
   - Examples: `gpt-4`, `claude-3-opus`, `llama-3`, etc.

### Optional Settings

3. **Custom Endpoint** (for non-OpenAI services)
   - Search for: `Syntaxtual: Custom Endpoint`
   - Examples:
     - LM Studio: `http://localhost:1234/v1`
     - Ollama (with OpenAI compatibility): `http://localhost:11434/v1`
     - Claude API: `https://api.anthropic.com/v1`

4. **Auto Analyze**
   - Search for: `Syntaxtual: Auto Analyze`
   - Enable to analyze files automatically on save

5. **Severity Threshold**
   - Search for: `Syntaxtual: Severity Threshold`
   - Options: `error`, `warning`, `info`

## Usage

### Analyze Your Code

1. **Click the Syntaxtual icon** in the Activity Bar (left sidebar)

2. **Run Analysis**:
   - **Analyze Repository**: Press `Ctrl+Shift+P` → "Syntaxtual: Analyze Repository"
   - **Analyze Current File**: Press `Ctrl+Shift+P` → "Syntaxtual: Review Current File"

3. **View Issues** in the Syntaxtual sidebar panel

### Discuss Issues

1. **Click on any detected issue** in the sidebar
2. **Ask questions** or request clarifications
3. **Get AI-powered explanations** and suggestions

### Apply Fixes

1. **Review the suggested fix** in the conversation
2. **Click "Apply Fix"** to automatically update your code
3. **Review the changes** and save

## Development

### Project Structure

```
SyntaxTual-VS-Code-Extention/
├── src/                      # Extension source code
│   ├── extension.ts          # Entry point
│   ├── auth/                 # Discord authentication
│   ├── config/               # Configuration management
│   ├── models/               # TypeScript interfaces
│   ├── providers/            # Diagnostics, decorations, sidebar
│   ├── services/             # Core services (AI, analysis)
│   └── utils/
├── webview/                  # React-based sidebar UI
│   ├── src/
│   │   ├── App.tsx          # Main webview app
│   │   ├── components/      # React components
│   │   └── hooks/
│   └── dist/                # Built webview assets
├── resources/               # Icons and assets
├── dist/                    # Compiled extension
└── package.json             # Extension manifest
```

### Available Scripts

```bash
# Build everything (extension + webview)
npm run build

# Build only the extension
npm run build:extension

# Build only the webview
npm run build:webview

# Watch mode (auto-rebuild on changes)
npm run watch

# Webview development with hot reload
cd webview && npm run dev
```

### Watch Mode for Development

For the best development experience:

1. **Run watch mode**:
   ```bash
   npm run watch
   ```

2. **Press F5** in VS Code to start debugging

3. **Make changes** to the code - they'll automatically rebuild

4. **Reload the extension** in the debug window (Ctrl+R)

## Supported AI Services

### OpenAI (Default)
- Set API key only
- Models: `gpt-4-turbo-preview`, `gpt-4`, `gpt-3.5-turbo`

### Claude (Anthropic)
- Set Custom Endpoint: `https://api.anthropic.com/v1`
- Set Model: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`
- Set API Key: Your Anthropic API key

### Local LLMs (LM Studio, Ollama)
- **LM Studio**:
  - Start LM Studio server
  - Set Custom Endpoint: `http://localhost:1234/v1`
  - Set Model: Your loaded model name

- **Ollama** (with OpenAI compatibility):
  - Run: `OLLAMA_ORIGINS=* ollama serve`
  - Set Custom Endpoint: `http://localhost:11434/v1`
  - Set Model: `llama3`, `mistral`, etc.

### Other OpenAI-Compatible APIs
Any service with OpenAI-compatible API will work!

## Troubleshooting

### Extension Not Activating
- Check the Debug Console (Ctrl+Shift+Y) for errors
- Ensure all dependencies are installed: `npm install`
- Rebuild: `npm run build`

### Webview Not Loading
- Build the webview: `cd webview && npm run build`
- Check that `webview/dist/` contains `index.js` and `index.css`
- Reload the extension window (Ctrl+R)

### API Errors
- Verify your API key is correct
- Check Custom Endpoint URL format (must include `/v1`)
- Ensure the model name matches your provider's available models
- Check network connectivity

### No Issues Detected
- Verify API key and model are configured
- Check exclude patterns in settings
- Try analyzing a different file
- Look for errors in the Debug Console

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/Duo-Keyboard-Koalition/SyntaxTual-VS-Code-Extention/issues)
- Discussions: [Ask a question](https://github.com/Duo-Keyboard-Koalition/SyntaxTual-VS-Code-Extention/discussions)

---

Made with ❤️ by the Syntaxtual Team
