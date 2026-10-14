# Assistant — Kete Intelligence

A question answered with the readings the person may open, and nothing else (kete-core specs 089,
090 and 101). She asks from the drawer beside any page (« Demander », Ctrl J, or Ctrl K's question);
the turn runs on the chassis' agents runtime (`@kete/agents`) and is streamed as it happens, in the
contract `intelligence-event.v1`: each reading as it starts and ends with its level, the words as
they come, the end. Its only tools are her level-1 capabilities, so it reads what she may read and
changes nothing; what she asked to be remembered is given back as context.

```mermaid
flowchart LR
  Q[her question · the drawer] --> R[/api/intelligence · her rights, the page she asks from]
  R --> S[stream.ts · streamAgent]
  S -->|level-1 capabilities only| G[registry]
  S -->|no model configured| N[« not connected »]
  S --> T[toIntelligence · one JSON line per event]
  T --> D[IntelligencePanel · status, readings, words, end]
```

- `SYSTEM` holds the rules the model follows; adapt it to the trade, keep the rules.
- A gesture is never offered here: the person does it on its screen, or an agent prepares a draft
  elsewhere. A product that offers drafts in the drawer widens `tools` and keeps their levels: the
  drawer shows each draft with « Vérifier ».
- `askApp` answers the same question in one piece, for a channel that cannot stream (WhatsApp).
- The model is configuration (`KETE_AI_*`), never code.
