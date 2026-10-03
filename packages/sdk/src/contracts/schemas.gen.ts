// Generated from /contracts by `pnpm contracts:generate`. Do not edit.
export const schemas = {
  "capability.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/capability.v1.schema.json",
    "title": "Capability",
    "description": "A gesture or a query a Kete product exposes to agents (MCP, chat, other apps), with its autonomy level: 1 read and signal, 2 act reversibly (with a notification and undo), 3 prepare a decision (a draft a person validates), 4 irreversible, money or external (always a person, with confirmation). It may name the view a copilot shows with its result (MCP Apps, doctrine D-037).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "description",
      "autonomy",
      "reversible",
      "permission",
      "input"
    ],
    "properties": {
      "name": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,62}$",
        "description": "snake_case: a valid tool name for MCP and every model provider."
      },
      "description": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "autonomy": {
        "enum": [
          1,
          2,
          3,
          4
        ]
      },
      "reversible": {
        "type": "boolean"
      },
      "inverse": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
        "description": "The command that undoes it (a @kete/commands name, kebab-case)."
      },
      "permission": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$"
      },
      "input": {
        "type": "object",
        "description": "The input's JSON Schema."
      },
      "output": {
        "type": "object",
        "description": "The output's JSON Schema, when declared."
      },
      "view": {
        "type": "string",
        "pattern": "^ui://[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9/_-]*$",
        "description": "The view a host shows with the result, as an MCP Apps UI resource: ui://kete/review for a draft to verify, or a view of the product."
      }
    }
  },
  "dataset.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/dataset.v1.schema.json",
    "title": "Dataset",
    "description": "A set of rows a Kete product exposes to people's dashboards, to its assistant and to other apps, always under the reader's rights: its name, what it holds, the permission to read it, the JSON Schema of one row, and which fields are a date, measures or dimensions. Read at the product's API: GET {api}/datasets/{name}.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "description",
      "permission",
      "row"
    ],
    "properties": {
      "name": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,62}$"
      },
      "description": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "permission": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$"
      },
      "row": {
        "type": "object",
        "description": "The JSON Schema of one row."
      },
      "time": {
        "type": "string",
        "description": "The field that dates a row: the API filters on it with `from` and `to`."
      },
      "measures": {
        "type": "array",
        "description": "Numeric fields a dashboard sums, averages or counts.",
        "uniqueItems": true,
        "items": {
          "type": "string"
        }
      },
      "dimensions": {
        "type": "array",
        "description": "Fields a dashboard groups by.",
        "uniqueItems": true,
        "items": {
          "type": "string"
        }
      }
    }
  },
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
      "capabilities": {
        "type": "array",
        "description": "What the app exposes to agents (optional, added in v1: additive).",
        "items": {
          "$ref": "capability.v1.schema.json"
        }
      },
      "datasets": {
        "type": "array",
        "description": "The data sets the app exposes, read at its API under the reader's rights (optional, added in v1: additive).",
        "items": {
          "$ref": "dataset.v1.schema.json"
        }
      },
      "endpoints": {
        "type": "object",
        "description": "Where agents and other apps reach the app (optional, added in v1: additive): its MCP server and its API.",
        "additionalProperties": false,
        "properties": {
          "mcp": {
            "type": "string",
            "format": "uri"
          },
          "api": {
            "type": "string",
            "format": "uri"
          }
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
      },
      "governance": {
        "type": "object",
        "description": "The app's identity card (optional, added in v1: additive; doctrine D-040): who answers for it, what data it handles, whether it uses AI, and what an outage costs. A registry deduces from it the controls that apply.",
        "additionalProperties": false,
        "required": [
          "owner",
          "dataCategories",
          "ai",
          "criticality"
        ],
        "properties": {
          "owner": {
            "type": "object",
            "description": "The person or team that answers for the app.",
            "additionalProperties": false,
            "required": [
              "name"
            ],
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 120
              },
              "contact": {
                "type": "string",
                "format": "email"
              }
            }
          },
          "dataCategories": {
            "type": "array",
            "description": "The kinds of data the app handles. personal: about an identifiable person; special: health, biometrics, beliefs, origin and other sensitive personal data; children: about minors; financial: amounts, accounts, invoices; payment: payment instruments; location: where someone is; credentials: secrets that open access; confidential: business data not meant to leave the organization; none: none of these.",
            "uniqueItems": true,
            "minItems": 1,
            "items": {
              "enum": [
                "none",
                "personal",
                "special",
                "children",
                "financial",
                "payment",
                "location",
                "credentials",
                "confidential"
              ]
            },
            "if": {
              "contains": {
                "const": "none"
              }
            },
            "then": {
              "maxItems": 1
            }
          },
          "ai": {
            "type": "object",
            "description": "Whether the app calls AI models itself (its capabilities, used by agents, are listed apart).",
            "additionalProperties": false,
            "required": [
              "used"
            ],
            "properties": {
              "used": {
                "type": "boolean"
              },
              "purpose": {
                "type": "string",
                "minLength": 1,
                "maxLength": 200
              }
            }
          },
          "criticality": {
            "description": "What an outage costs. low: an inconvenience; medium: work slows down; high: work stops or money is lost; critical: safety, legal obligations, or every customer at once.",
            "enum": [
              "low",
              "medium",
              "high",
              "critical"
            ]
          }
        }
      }
    }
  }
} as const;
