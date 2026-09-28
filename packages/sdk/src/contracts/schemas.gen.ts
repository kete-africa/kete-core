// Generated from /contracts by `pnpm contracts:generate`. Do not edit.
export const schemas = {
  "delivery-request.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/delivery-request.v1.schema.json",
    "title": "DeliveryRequest",
    "description": "A signed batch of events sent to a receiver.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "events"
    ],
    "properties": {
      "events": {
        "type": "array",
        "minItems": 1,
        "maxItems": 100,
        "items": {
          "$ref": "event.v1.schema.json"
        }
      }
    }
  },
  "delivery-result.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/delivery-result.v1.schema.json",
    "title": "DeliveryResult",
    "description": "The receiver's outcome for each event of a batch.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "results"
    ],
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "outcome"
          ],
          "properties": {
            "id": {
              "type": "string"
            },
            "outcome": {
              "enum": [
                "accepted",
                "duplicate",
                "refused"
              ]
            },
            "reason": {
              "enum": [
                "invalid_signature",
                "stale",
                "unknown_product",
                "invalid_payload",
                "undeclared_type",
                "batch_too_large"
              ]
            }
          }
        }
      }
    }
  },
  "event-data.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/event-data.v1.schema.json",
    "title": "StandardEventData",
    "description": "The data payload of each standard event type. Facts and counters only; amounts are integers in the currency's smallest unit.",
    "$defs": {
      "AccountCreated": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "plan": {
            "type": "string",
            "maxLength": 60
          }
        }
      },
      "AccountActivated": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "activation"
        ],
        "properties": {
          "activation": {
            "type": "string",
            "maxLength": 60
          }
        }
      },
      "PaymentSucceeded": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "amount",
          "currency",
          "reference"
        ],
        "properties": {
          "amount": {
            "type": "integer",
            "minimum": 0
          },
          "currency": {
            "type": "string",
            "pattern": "^[A-Z]{3}$"
          },
          "reference": {
            "type": "string",
            "maxLength": 100
          }
        }
      },
      "PaymentFailed": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "amount",
          "currency",
          "reason_code"
        ],
        "properties": {
          "amount": {
            "type": "integer",
            "minimum": 0
          },
          "currency": {
            "type": "string",
            "pattern": "^[A-Z]{3}$"
          },
          "reason_code": {
            "type": "string",
            "maxLength": 60
          }
        }
      },
      "SubscriptionRenewalDue": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "due_on",
          "plan"
        ],
        "properties": {
          "due_on": {
            "type": "string",
            "format": "date"
          },
          "plan": {
            "type": "string",
            "maxLength": 60
          }
        }
      },
      "AccountClosed": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "reason_code": {
            "type": "string",
            "maxLength": 60
          }
        }
      },
      "MetricsDaily": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "day",
          "counters"
        ],
        "properties": {
          "day": {
            "type": "string",
            "format": "date"
          },
          "counters": {
            "type": "object",
            "propertyNames": {
              "pattern": "^[a-z][a-z0-9_]{0,59}$"
            },
            "additionalProperties": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    }
  },
  "event.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/event.v1.schema.json",
    "title": "KeteEvent",
    "description": "An immutable fact announced by a Kete app. Facts and counters only: no names, e-mails or phone numbers.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "type",
      "specversion",
      "product",
      "organization",
      "occurred_at",
      "data"
    ],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^evt_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
      },
      "type": {
        "type": "string",
        "maxLength": 100,
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
      },
      "specversion": {
        "const": "1"
      },
      "product": {
        "type": "string",
        "pattern": "^prd_[a-z0-9_]{2,40}$"
      },
      "organization": {
        "type": "string",
        "pattern": "^org_[A-Za-z0-9_-]{4,64}$"
      },
      "occurred_at": {
        "type": "string",
        "format": "date-time"
      },
      "data": {
        "type": "object"
      }
    }
  },
  "health.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/health.v1.schema.json",
    "title": "HealthReport",
    "description": "A Kete app's health, served at GET /health. Never exposes secrets or connection strings.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "status",
      "version",
      "checked_at",
      "dependencies",
      "outbox"
    ],
    "properties": {
      "status": {
        "enum": [
          "healthy",
          "degraded",
          "down"
        ]
      },
      "version": {
        "type": "string"
      },
      "checked_at": {
        "type": "string",
        "format": "date-time"
      },
      "dependencies": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name",
            "status"
          ],
          "properties": {
            "name": {
              "type": "string",
              "maxLength": 60
            },
            "status": {
              "enum": [
                "up",
                "down"
              ]
            },
            "latency_ms": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      },
      "outbox": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "pending"
        ],
        "properties": {
          "pending": {
            "type": "integer",
            "minimum": 0
          },
          "oldest_pending_age_seconds": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    }
  },
  "manifest.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/manifest.v1.schema.json",
    "title": "Manifest",
    "description": "A Kete app's self-description, served at GET /.well-known/kete.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "product",
      "name",
      "version",
      "environment",
      "events"
    ],
    "properties": {
      "product": {
        "type": "string",
        "pattern": "^prd_[a-z0-9_]{2,40}$"
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 80
      },
      "version": {
        "type": "string",
        "pattern": "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$"
      },
      "environment": {
        "enum": [
          "production",
          "staging",
          "preview",
          "development"
        ]
      },
      "events": {
        "type": "array",
        "uniqueItems": true,
        "items": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
        }
      },
      "links": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "repository": {
            "type": "string",
            "format": "uri"
          },
          "documentation": {
            "type": "string",
            "format": "uri"
          }
        }
      }
    }
  }
} as const;
