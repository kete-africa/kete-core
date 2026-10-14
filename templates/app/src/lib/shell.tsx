import { FeedbackButton } from '@kete/feedback/button';
import {
  IntelligencePanel,
  postTo,
  useIntelligence,
  type IntelligenceWords,
} from '@kete/intelligence';
import { AppFrame, allPlaces, placesFor, type ShellWords } from '@kete/shell';
import { useRouteContext, useRouterState } from '@tanstack/react-router';
import { useMemo, useState, type ReactNode } from 'react';
import app from '../../kete.json' with { type: 'json' };
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

async function sendFeedback(input: object): Promise<void> {
  const response = await fetch('/api/avis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`feedback: ${response.status}`);
}

/** Every word of the frame, from this app's catalogs (kete-core spec 100). */
function shellWords(): ShellWords {
  return {
    nav: m.shell_nav(),
    showNav: m.shell_show_nav(),
    hideNav: m.shell_hide_nav(),
    search: m.shell_search(),
    palette: m.shell_palette(),
    palettePlaceholder: m.shell_palette_placeholder(),
    paletteEmpty: m.shell_palette_empty(),
    palettePlaces: m.shell_palette_places(),
    paletteFound: m.shell_palette_found(),
    paletteAsk: m.shell_palette_ask(),
    paletteAskItem: (question) => m.shell_palette_ask_item({ question }),
    ask: m.shell_ask(),
    files: m.shell_files(),
    note: m.shell_note(),
    bell: m.shell_bell(),
    tabs: m.shell_tabs(),
    menu: m.shell_menu(),
    noteTitle: m.shell_note_title(),
    noteField: m.shell_note_field(),
    noteHint: m.shell_note_hint(),
    noteSave: m.shell_note_save(),
    close: m.shell_close(),
    theme: m.theme_label(),
    themes: { dark: m.theme_dark(), light: m.theme_light(), auto: m.theme_auto() },
    signOut: m.nav_sign_out(),
    sync: {
      ok: m.shell_sync_ok(),
      offline: (pending) => m.shell_sync_offline({ count: String(pending) }),
      sending: m.shell_sync_sending(),
    },
  };
}

/** Every word of Kete Intelligence's drawer, from this app's catalogs (kete-core spec 101). */
function intelligenceWords(): IntelligenceWords {
  const reasons: Record<string, () => string> = {
    not_connected: m.intelligence_not_connected,
    budget_spent: m.intelligence_budget_spent,
    confirmation_required: m.intelligence_confirmation,
  };
  return {
    thread: m.intelligence_thread(),
    you: m.intelligence_you(),
    assistant: m.intelligence_assistant(),
    composer: m.intelligence_composer(),
    placeholder: m.intelligence_placeholder(),
    send: m.intelligence_send(),
    stop: m.intelligence_stop(),
    hint: m.intelligence_hint(),
    context: m.intelligence_context(),
    suggestions: m.intelligence_suggestions(),
    thinking: m.intelligence_thinking(),
    reading: (tool) => m.intelligence_reading({ tool }),
    plan: m.intelligence_plan(),
    level: (level) => m.intelligence_level({ level: String(level) }),
    toolState: {
      running: m.intelligence_running(),
      done: m.intelligence_done_tool(),
      failed: m.intelligence_failed_tool(),
    },
    sources: m.intelligence_sources(),
    draft: m.intelligence_draft(),
    verify: m.intelligence_verify(),
    done: (tools, seconds) =>
      m.intelligence_done({ tools: String(tools), seconds: String(seconds) }),
    stopped: m.intelligence_stopped(),
    reason: (code) => (reasons[code] ?? m.intelligence_failed)(),
  };
}

/**
 * The frame of every signed-in screen (kete-core specs 100 and 101): the places of `kete.json`,
 * Ctrl K, Kete Intelligence beside the page, the phone's tabs — the same frame as the center and
 * every Kete app.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const context = useRouteContext({ strict: false }) as { person?: { name: string } };
  const path = useRouterState({ select: (state) => state.location.pathname });
  const sections = placesFor(app.places, { lang: getLocale() === 'en' ? 'en' : 'fr' });
  const current = allPlaces(sections).find(
    (place) => place.href === path || (place.href !== '/' && path.startsWith(`${place.href}/`)),
  )?.id;
  // Kete Intelligence beside the page (kete-core spec 101): the page she asks from goes with her
  // question; the drawer keeps the page in view.
  const page = current
    ? allPlaces(sections).find((place) => place.id === current)?.label
    : undefined;
  const transport = useMemo(() => postTo('/api/intelligence', page ? { page } : {}), [page]);
  const intelligence = useIntelligence(transport);
  const [open, setOpen] = useState(false);
  return (
    <AppFrame
      brand={m.app_name()}
      sections={sections}
      {...(current ? { current } : {})}
      person={{ name: context.person?.name ?? '' }}
      words={shellWords()}
      onAsk={(question) => {
        setOpen(true);
        if (question) void intelligence.send(question);
      }}
      beside={{
        open,
        label: m.intelligence_label(),
        onClose: () => setOpen(false),
        content: (
          <IntelligencePanel
            turns={intelligence.turns}
            running={intelligence.running}
            onSend={(question) => void intelligence.send(question)}
            onStop={intelligence.stop}
            words={intelligenceWords()}
            {...(page ? { context: page } : {})}
            intro={m.intelligence_intro()}
            suggestions={[m.intelligence_suggest_open(), m.intelligence_suggest_late()]}
          />
        ),
      }}
      tabs={app.places.map((place) => place.id)}
      signOutHref="/auth/sortie"
      tools={
        <FeedbackButton
          labels={{
            open: m.feedback_open(),
            title: m.feedback_title(),
            kinds: {
              problem: m.feedback_problem(),
              idea: m.feedback_idea(),
              praise: m.feedback_praise(),
            },
            kindsLabel: m.feedback_kind(),
            message: m.feedback_message(),
            send: m.feedback_send(),
            close: m.feedback_close(),
            thanks: m.feedback_thanks(),
            error: m.feedback_error(),
          }}
          onSubmit={sendFeedback}
        />
      }
    >
      {children}
    </AppFrame>
  );
}
