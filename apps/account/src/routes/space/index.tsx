import { createFileRoute, Link } from '@tanstack/react-router';
import { Tag } from '@kete/design';
import { fetchTools } from '@/features/identity/functions';
import type { ToolEntry } from '@/features/tools/catalog';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

export const Route = createFileRoute('/espace/')({
  loader: () => fetchTools(),
  component: Tools,
});

const purpose: Record<ToolEntry['id'], () => string> = {
  firmo: m.tool_firmo,
  nettio: m.tool_nettio,
  nyatefe: m.tool_nyatefe,
  cockpit: m.tool_cockpit,
};

function Tools() {
  const tools = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-headline font-extrabold">{m.tools_title()}</h1>
        <p className="text-body-lg text-bark">{m.tools_intro()}</p>
      </div>
      <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.id} className="flex flex-col gap-4 bg-paper p-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-title text-title font-bold">{tool.name}</h2>
              <p className="text-body-sm text-bark">{purpose[tool.id]()}</p>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              {tool.accessUntil && (
                <Tag tone="validated">
                  {m.tools_subscribed_until({
                    date: new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(
                      new Date(tool.accessUntil),
                    ),
                  })}
                </Tag>
              )}
              {tool.url ? (
                <a
                  href={tool.url}
                  className="inline-flex h-10 items-center rounded-control border border-ink px-4 text-body-sm font-semibold hover:bg-clay"
                >
                  {m.tool_open()}
                </a>
              ) : (
                !tool.accessUntil && <Tag tone="neutral">{m.tools_soon_tag()}</Tag>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-body-sm">
        <Link to="/espace/abonnements" className="font-semibold text-primary underline">
          {m.tools_see_billing()}
        </Link>
      </p>
    </div>
  );
}
