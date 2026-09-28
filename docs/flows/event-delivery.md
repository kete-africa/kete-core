# Flow — event delivery

From a business change in an app to its acceptance by the receiver.

```mermaid
sequenceDiagram
    participant A as App transaction
    participant O as kete_outbox
    participant R as Relay
    participant K as Receiver
    A->>O: insert event (same transaction as the change)
    R->>O: claim due events (lease, SKIP LOCKED)
    R->>K: POST signed batch
    alt receiver reachable
        K-->>R: per event: accepted | duplicate | refused
        R->>O: delivered / refused
    else receiver down or answer lost
        R->>O: pending, next attempt after backoff (5 s → 1 h)
    end
    Note over R,O: a crashed relay's lease expires; the events are claimed again
```

At-least-once from the app, exactly-once at the receiver: the receiver stores each event id once.
