import { App } from '@modelcontextprotocol/ext-apps';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import en from '../messages/en.json' with { type: 'json' };
import fr from '../messages/fr.json' with { type: 'json' };
import { ViewRoot, type Labels, type ViewHost } from './view.js';
import './view.css';

// The page an MCP host shows in its conversation (doctrine D-037): it receives the tool's result,
// follows the host's theme and language, and calls the server's tools for the person's decisions.

const app = new App({ name: 'kete-views', version: '1.0.0' });

function labelsFor(locale: string | undefined): Labels {
  return locale?.toLowerCase().startsWith('en') ? en : fr;
}

function applyTheme(theme: string | undefined) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

const host: ViewHost = {
  async call(tool, args) {
    const result = await app.callServerTool({ name: tool, arguments: args });
    return result.structuredContent as Record<string, unknown> | undefined;
  },
  open(url) {
    void app.openLink({ url });
  },
};

function Root() {
  const [content, setContent] = useState<Record<string, unknown>>();
  const [locale, setLocale] = useState<string>();
  useEffect(() => {
    app.ontoolresult = (params) => setContent(params.structuredContent as Record<string, unknown>);
    app.onhostcontextchanged = (context) => {
      applyTheme(context.theme);
      if (context.locale) setLocale(context.locale);
    };
    void app.connect().then(() => {
      const context = app.getHostContext();
      applyTheme(context?.theme);
      setLocale(context?.locale);
    });
  }, []);
  return (
    <main className="bg-canvas p-3 font-ui text-body text-fg">
      <ViewRoot content={content} labels={labelsFor(locale)} host={host} />
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
