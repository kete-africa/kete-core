# @kete/feedback

The feedback button of every Kete App: **what goes wrong, an idea, or what works**, said where it
happens, kept per organization (RLS), read by the team.

```mermaid
flowchart LR
  B[FeedbackButton<br/>@kete/feedback/button] -->|POST| H[createFeedbackHandler]
  H -->|the person, her organization| S[(kete_feedback · RLS)]
```

```ts
// migration (with its RLS policy, constitution V)
feedbackMigrationSql({ appRole: 'nettio_app' });

// route
export const POST = createFeedbackHandler({ caller: fromSession, transaction });

// screen (client-safe entry)
import { FeedbackButton } from '@kete/feedback/button';
<FeedbackButton labels={labelsFromCatalogs} onSubmit={postToTheHandler} />
```

- A person only (never an agent); a message of 1 to 2,000 characters; the page without its query.
- Append-only: the application role adds and reads, never changes.
