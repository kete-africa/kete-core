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
      },
      "classification": {
        "enum": [
          "public",
          "internal",
          "confidential",
          "secret"
        ],
        "description": "How far the data may travel. public: anyone; internal (the default): the organization's people with the permission; confidential: a need to know, never in a shared briefing; secret: never sent to a model, a shared briefing nor a notification's text."
      }
    }
  },
  "dataset-answer.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/dataset-answer.v1.schema.json",
    "title": "DatasetAnswer",
    "description": "An app's answer to a data set's question (dataset-query.v1; kete-core spec 144): the groups, each with its measures, the largest first; how many rows were summed up; the axes it applied; when it was read. Only this travels, never the rows.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "dataset",
      "rows",
      "counted",
      "truncated",
      "filter",
      "at"
    ],
    "properties": {
      "dataset": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,62}$"
      },
      "rows": {
        "type": "array",
        "maxItems": 500,
        "items": {
          "type": "object",
          "additionalProperties": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "string"
              },
              {
                "type": "boolean"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "counted": {
        "description": "The rows summed up, after the filters.",
        "type": "integer",
        "minimum": 0
      },
      "truncated": {
        "description": "True: more rows than the app sums up at once (50 000), or more groups than asked.",
        "type": "boolean"
      },
      "filter": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "project_id": {
            "type": "string",
            "pattern": "^prj_[0-9a-f-]{8,64}$"
          },
          "party_id": {
            "type": "string",
            "pattern": "^pty_[0-9a-f-]{8,64}$"
          },
          "unit_id": {
            "type": "string",
            "pattern": "^unt_[0-9a-f-]{8,64}$"
          },
          "person_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "object_id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
          }
        },
        "description": "The axes it applied."
      },
      "at": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "dataset-query.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/dataset-query.v1.schema.json",
    "title": "DatasetQuery",
    "description": "A question put to an app's data set (dataset.v1) at POST {api}/datasets/{name}/query, under the reader's rights (kete-core spec 144, ADR 0015): its rows filtered on the center's axes and on its own fields, grouped, summed up at the app; only the answer travels (dataset-answer.v1). No one writes a query language: every field named is one of the data set's own.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "measures"
    ],
    "properties": {
      "filter": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "project_id": {
            "type": "string",
            "pattern": "^prj_[0-9a-f-]{8,64}$"
          },
          "party_id": {
            "type": "string",
            "pattern": "^pty_[0-9a-f-]{8,64}$"
          },
          "unit_id": {
            "type": "string",
            "pattern": "^unt_[0-9a-f-]{8,64}$"
          },
          "person_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "object_id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
          }
        },
        "description": "The center's axes, through the data set's `axes`: an axis it does not carry is left out, and the answer says which it applied."
      },
      "where": {
        "description": "Filters on the data set's own fields, all of them true.",
        "type": "array",
        "maxItems": 10,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "field",
            "op",
            "value"
          ],
          "properties": {
            "field": {
              "type": "string",
              "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
            },
            "op": {
              "enum": [
                "eq",
                "neq",
                "gte",
                "lte",
                "contains"
              ]
            },
            "value": {
              "anyOf": [
                {
                  "type": "number"
                },
                {
                  "type": "string",
                  "maxLength": 200
                }
              ]
            }
          }
        }
      },
      "group_by": {
        "description": "Up to three of its dimensions.",
        "type": "array",
        "maxItems": 3,
        "items": {
          "type": "string",
          "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
        }
      },
      "measures": {
        "description": "What each group sums up; a group's value is named `count`, or `fn(field)`: « sum(amount) ».",
        "type": "array",
        "minItems": 1,
        "maxItems": 6,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "fn"
          ],
          "properties": {
            "fn": {
              "enum": [
                "count",
                "sum",
                "avg",
                "min",
                "max"
              ]
            },
            "field": {
              "type": "string",
              "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
            }
          }
        }
      },
      "from": {
        "description": "Rows whose time field is on or after this day.",
        "type": "string",
        "format": "date"
      },
      "to": {
        "description": "Rows whose time field is on or before this day.",
        "type": "string",
        "format": "date"
      },
      "limit": {
        "description": "At most this many groups, the largest first (default 100).",
        "type": "integer",
        "minimum": 1,
        "maximum": 500
      }
    }
  },
  "dataset.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/dataset.v1.schema.json",
    "title": "Dataset",
    "description": "A set of rows a Kete product exposes to people's dashboards, to its assistant and to other apps, always under the reader's rights: its name, what it holds, the permission to read it, the JSON Schema of one row, and which fields are a date, measures or dimensions. Read at the product's API: GET {api}/datasets/{name}; summed up there: POST {api}/datasets/{name}/query (dataset-query.v1).",
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
      },
      "classification": {
        "enum": [
          "public",
          "internal",
          "confidential",
          "secret"
        ],
        "description": "How far the data may travel. public: anyone; internal (the default): the organization's people with the permission; confidential: a need to know, never in a shared briefing; secret: never sent to a model, a shared briefing nor a notification's text."
      },
      "axes": {
        "description": "Which fields carry the center's four axes and the object a row is about (added in v1: additive; doctrine D-062, R2; kete-core spec 144): a filter « project = X » then applies to every app's rows at once, at the app.",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "project": {
            "type": "string",
            "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
          },
          "party": {
            "type": "string",
            "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
          },
          "unit": {
            "type": "string",
            "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
          },
          "person": {
            "type": "string",
            "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
          },
          "object": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "field"
            ],
            "properties": {
              "kind": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]{1,40}$"
              },
              "field": {
                "type": "string",
                "pattern": "^[A-Za-z_][A-Za-z0-9_]{0,79}$"
              }
            }
          }
        }
      }
    }
  },
  "dated-fact.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/dated-fact.v1.schema.json",
    "title": "DatedFact",
    "description": "Something an app says will happen at a time — a meeting, a deadline, an absence, a task, a milestone, an agent's run — so that the center's Planifier shows the time of the whole organization (doctrine D-050). Sent again under the same key, it replaces what was said; sent with `cancelled`, it is taken back. Exactly one of `day` (a whole day) or `starts_at` (a moment) is given.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "kind",
      "label"
    ],
    "oneOf": [
      {
        "required": [
          "day"
        ],
        "properties": {
          "day": true
        }
      },
      {
        "required": [
          "starts_at"
        ],
        "properties": {
          "starts_at": true
        }
      }
    ],
    "properties": {
      "key": {
        "description": "The app's own key for this fact: one fact per app and key.",
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "kind": {
        "description": "meeting: people meet. deadline: something is due (an invoice, a report, a contract's term). absence: a person is away. task: a piece of work with its duration. milestone: a step of a project. agent_run: an agent or a routine will run.",
        "enum": [
          "meeting",
          "deadline",
          "absence",
          "task",
          "milestone",
          "agent_run"
        ]
      },
      "label": {
        "description": "What it is, as a person reads it: « Échéance F-2026-0003 », « Réception du matériel ».",
        "type": "string",
        "minLength": 1,
        "maxLength": 300
      },
      "day": {
        "description": "A whole day. With `until`, the last day of a span (a leave from the 2nd to the 6th).",
        "type": "string",
        "format": "date"
      },
      "until": {
        "description": "The last day of a span that started on `day`.",
        "type": "string",
        "format": "date"
      },
      "starts_at": {
        "type": "string",
        "format": "date-time"
      },
      "ends_at": {
        "description": "When a fact with a moment ends; none for an instant.",
        "type": "string",
        "format": "date-time"
      },
      "person_ids": {
        "description": "The people of the center it concerns: who meets, who is away, who must do it.",
        "type": "array",
        "uniqueItems": true,
        "maxItems": 50,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        }
      },
      "project_id": {
        "type": "string",
        "pattern": "^prj_[0-9a-f-]{8,64}$"
      },
      "party_id": {
        "type": "string",
        "pattern": "^pty_[0-9a-f-]{8,64}$"
      },
      "visibility": {
        "description": "shared (the default): its label is read by whoever may read its project or its people. busy: others see only that the person is taken. private: only the people it concerns see it. An absence is always read without its reason.",
        "enum": [
          "shared",
          "busy",
          "private"
        ]
      },
      "href": {
        "description": "Where it is read, in the app.",
        "type": "string",
        "format": "uri",
        "maxLength": 600
      },
      "cancelled": {
        "description": "True takes the fact back.",
        "type": "boolean"
      },
      "object": {
        "description": "The object it is about (optional, added in v1: additive; kete-core spec 142): it inherits that object's axes (D-062, R2).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{1,40}$"
          },
          "id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
          }
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
      },
      "DeploymentRequested": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "deployment_id",
          "product",
          "mode",
          "region",
          "apps"
        ],
        "properties": {
          "deployment_id": {
            "type": "string",
            "maxLength": 64
          },
          "product": {
            "type": "string",
            "pattern": "^prd_[a-z0-9_]{2,40}$"
          },
          "mode": {
            "enum": [
              "shared",
              "dedicated",
              "on_premises",
              "autonomous"
            ]
          },
          "region": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{1,40}$"
          },
          "apps": {
            "type": "array",
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^prd_[a-z0-9_]{2,40}$"
            }
          }
        }
      },
      "DeploymentReady": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "deployment_id",
          "product",
          "mode",
          "url"
        ],
        "properties": {
          "deployment_id": {
            "type": "string",
            "maxLength": 64
          },
          "product": {
            "type": "string",
            "pattern": "^prd_[a-z0-9_]{2,40}$"
          },
          "mode": {
            "enum": [
              "shared",
              "dedicated",
              "on_premises",
              "autonomous"
            ]
          },
          "url": {
            "type": "string",
            "format": "uri",
            "maxLength": 300
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
      },
      "object": {
        "description": "The object the fact is about (optional, added in v1: additive; doctrine D-062, R11; kete-core spec 143): its thread, the agents and the screens that follow it learn it.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{1,40}$"
          },
          "id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
          }
        }
      }
    }
  },
  "file-link.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/file-link.v1.schema.json",
    "title": "FileLink",
    "description": "A file an app keeps, said to the center with what it proves: the object it is linked to, its role there, its nature and where it came from. The file stays in the app; the center keeps the link, so that search and the assistant find it across Kete, read under the rights of the linked object. Sent again under the same key, it replaces what was said.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "name",
      "object",
      "role"
    ],
    "properties": {
      "key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "name": {
        "description": "The file's name, as shown.",
        "type": "string",
        "minLength": 1,
        "maxLength": 300
      },
      "object": {
        "description": "What it is linked to: a record of the app, or a reference of the center.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "role": {
        "description": "What it proves there, as a person reads it: « bon de commande signé », « justificatif ».",
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "nature": {
        "enum": [
          "receipt",
          "supplier_invoice",
          "invoice",
          "purchase_order",
          "contract",
          "statement",
          "identity",
          "photo",
          "other"
        ]
      },
      "origin": {
        "enum": [
          "whatsapp",
          "telegram",
          "email",
          "upload",
          "generated"
        ]
      },
      "project_id": {
        "type": "string",
        "pattern": "^prj_[0-9a-f-]{8,64}$"
      },
      "party_id": {
        "type": "string",
        "pattern": "^pty_[0-9a-f-]{8,64}$"
      },
      "keep_until": {
        "description": "Until when it must be kept (a book-keeping piece: ten years).",
        "type": "string",
        "format": "date"
      },
      "href": {
        "type": "string",
        "format": "uri",
        "maxLength": 600
      }
    }
  },
  "gesture.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/gesture.v1.schema.json",
    "title": "Gesture",
    "description": "A gesture about to be made, by a person or an agent acting for one, as the policy engine reads it before the command runs (doctrine D-058, spec 112): who, what, on what, how much, through which channel, towards whom. The same gesture by a person and by her agent is the same gesture.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "actor",
      "kind",
      "object",
      "at"
    ],
    "properties": {
      "actor": {
        "description": "Who makes it. An agent always acts for a person.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "person",
              "agent"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "on_behalf_of": {
            "description": "The person an agent acts for.",
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "kind": {
        "description": "What it does, named by the product: invoice.validate, message.client, purchase.commit, contract.sign, document.read…",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
        "maxLength": 80
      },
      "object": {
        "description": "What it acts on: a project, a party, a document, a card.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "amount": {
        "description": "How much it commits, in the currency's smallest unit.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "value",
          "currency"
        ],
        "properties": {
          "value": {
            "type": "integer",
            "minimum": 0
          },
          "currency": {
            "type": "string",
            "pattern": "^[A-Z]{3}$"
          }
        }
      },
      "channel": {
        "description": "Through which channel it goes out, when it reaches someone: whatsapp, telegram, mail, web.",
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      },
      "party": {
        "description": "The party outside it reaches, when it does.",
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "template": {
        "description": "The approved template it uses, when it writes to someone outside.",
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "context": {
        "description": "What else the product's policies read (an hour, a retention, an absence), flat.",
        "type": "object",
        "propertyNames": {
          "pattern": "^[a-zA-Z][a-zA-Z0-9_]{0,59}$"
        },
        "additionalProperties": {
          "oneOf": [
            {
              "type": "string",
              "maxLength": 200
            },
            {
              "type": "integer"
            },
            {
              "type": "boolean"
            }
          ]
        }
      },
      "at": {
        "description": "When it is about to be made.",
        "type": "string",
        "format": "date-time"
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
  "holding.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/holding.v1.schema.json",
    "title": "Holding",
    "description": "A thing in progress and who holds it (doctrine D-056, spec 111): a request, a step of a circuit, a draft to check, an action from a meeting, an agent's task. It always has a holder — a person, who answers for it (D-061); an agent works it as its delegate — and may wait on someone. An app says it under its source; said again under the same source, it replaces what was said. The center gives it its id.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "source",
      "object",
      "what",
      "holder",
      "state"
    ],
    "properties": {
      "id": {
        "description": "Given by the center when it keeps the holding; absent when an app says it.",
        "type": "string",
        "pattern": "^hld_[0-9A-Za-z_-]{4,70}$"
      },
      "source": {
        "description": "Where it comes from: one holding per app, kind and reference.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "app",
          "kind",
          "ref"
        ],
        "properties": {
          "app": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "kind": {
            "description": "What it is in that app: request, todo, meeting_action, circuit_step, draft, agent_task…",
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "object": {
        "description": "What it is about: a project, a party, a quote, a ticket, an asset.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "what": {
        "description": "What is to be done, as a person reads it: « Chiffrer le devis Garage Bè ».",
        "type": "string",
        "minLength": 1,
        "maxLength": 300
      },
      "holder": {
        "description": "Who holds it now, and answers for it. Never nobody. A person (D-061): an agent is its delegate. The kind `agent` is still read, deprecated: the center makes the agent's person the holder and the agent its delegate.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "person",
              "agent"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "delegate": {
        "description": "The agent working it for its holder (D-061, spec 140): the holder still answers for it.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "const": "agent"
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "return_to": {
        "description": "Whom the result goes to when it is done: the next step's person by the policy or the circuit, else whoever entrusted it (D-061, spec 140).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "person",
              "agent"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "waiting_on": {
        "description": "Who it waits for: a colleague, an agent, a party outside, or another holding (it comes back to its holder when that one is done); none when it is in the holder's hands.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "id"
            ],
            "properties": {
              "kind": {
                "enum": [
                  "person",
                  "agent",
                  "party",
                  "holding"
                ]
              },
              "id": {
                "type": "string",
                "minLength": 1,
                "maxLength": 100
              }
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "since": {
        "description": "Since when it is in progress.",
        "type": "string",
        "format": "date-time"
      },
      "due": {
        "description": "The day it is due, in the organization's time.",
        "type": "string",
        "format": "date"
      },
      "priority": {
        "description": "How urgent: « Pour moi » sorts by it first. Absent: normal.",
        "enum": [
          "low",
          "normal",
          "high",
          "urgent"
        ]
      },
      "snoozed_until": {
        "description": "Before this moment, « Pour moi » does not show it: the holder put it off.",
        "type": "string",
        "format": "date-time"
      },
      "state": {
        "description": "held: in the holder's hands. waiting: it waits on someone. done: finished.",
        "enum": [
          "held",
          "waiting",
          "done"
        ]
      },
      "href": {
        "description": "Where it opens: an https address of the app that says it, or a path of the center. Absent: the center finds its way from the source.",
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "for": {
        "description": "action: the holder must act. information: the holder is told, nothing more.",
        "enum": [
          "action",
          "information"
        ],
        "default": "action"
      }
    }
  },
  "intelligence-event.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/intelligence-event.v1.schema.json",
    "title": "IntelligenceEvent",
    "description": "One event of a Kete Intelligence turn, streamed from the agents' runtime to the screen: what it is doing now, its plan and each step, each tool it calls with its level, a draft for the person, a source, the answer's text as it is written, a wait for the person, the end or the failure. The same stream is shown in the center and in every app.",
    "oneOf": [
      {
        "$ref": "#/$defs/status"
      },
      {
        "$ref": "#/$defs/plan"
      },
      {
        "$ref": "#/$defs/step"
      },
      {
        "$ref": "#/$defs/tool"
      },
      {
        "$ref": "#/$defs/draft"
      },
      {
        "$ref": "#/$defs/source"
      },
      {
        "$ref": "#/$defs/text"
      },
      {
        "$ref": "#/$defs/waiting"
      },
      {
        "$ref": "#/$defs/done"
      },
      {
        "$ref": "#/$defs/failed"
      }
    ],
    "$defs": {
      "status": {
        "title": "IntelligenceStatus",
        "description": "What it is doing at this instant, in a sentence.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "text"
        ],
        "properties": {
          "type": {
            "const": "status"
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300
          }
        }
      },
      "plan": {
        "title": "IntelligencePlan",
        "description": "The steps it intends to take, shown before it acts.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "steps"
        ],
        "properties": {
          "type": {
            "const": "plan"
          },
          "steps": {
            "type": "array",
            "minItems": 1,
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            }
          }
        }
      },
      "step": {
        "title": "IntelligenceStep",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "index",
          "state"
        ],
        "properties": {
          "type": {
            "const": "step"
          },
          "index": {
            "type": "integer",
            "minimum": 0
          },
          "state": {
            "enum": [
              "running",
              "done",
              "skipped"
            ]
          }
        }
      },
      "tool": {
        "title": "IntelligenceTool",
        "description": "A capability it calls, with its autonomy level and what it gave back, in short.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "id",
          "name",
          "level",
          "state"
        ],
        "properties": {
          "type": {
            "const": "tool"
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "level": {
            "type": "integer",
            "minimum": 1,
            "maximum": 4
          },
          "state": {
            "enum": [
              "running",
              "done",
              "failed"
            ]
          },
          "input": {
            "type": "string",
            "maxLength": 2000
          },
          "summary": {
            "type": "string",
            "maxLength": 300
          }
        }
      },
      "draft": {
        "title": "IntelligenceDraft",
        "description": "A draft prepared for the person, decided in place.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "draft_id",
          "title"
        ],
        "properties": {
          "type": {
            "const": "draft"
          },
          "draft_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "href": {
            "type": "string",
            "format": "uri-reference",
            "maxLength": 600,
            "description": "Where it is opened: an address of the product, relative to its own screens, or absolute."
          }
        }
      },
      "source": {
        "title": "IntelligenceSource",
        "description": "What the answer rests on, opened by a click.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "label"
        ],
        "properties": {
          "type": {
            "const": "source"
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "href": {
            "type": "string",
            "format": "uri-reference",
            "maxLength": 600,
            "description": "Where it is opened: an address of the product, relative to its own screens, or absolute."
          }
        }
      },
      "text": {
        "title": "IntelligenceText",
        "description": "A piece of the answer as it is written.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "delta"
        ],
        "properties": {
          "type": {
            "const": "text"
          },
          "delta": {
            "type": "string",
            "maxLength": 20000
          }
        }
      },
      "waiting": {
        "title": "IntelligenceWaiting",
        "description": "It stops until the person answers or decides.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "reason"
        ],
        "properties": {
          "type": {
            "const": "waiting"
          },
          "reason": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300
          }
        }
      },
      "done": {
        "title": "IntelligenceDone",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "done"
          },
          "steps": {
            "type": "integer",
            "minimum": 0
          },
          "tools": {
            "type": "integer",
            "minimum": 0
          },
          "ms": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "failed": {
        "title": "IntelligenceFailed",
        "description": "It stopped; what was read is kept, nothing was changed by the failure.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "reason"
        ],
        "properties": {
          "type": {
            "const": "failed"
          },
          "reason": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300
          }
        }
      }
    }
  },
  "lesson.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/lesson.v1.schema.json",
    "title": "Lesson",
    "description": "What the use of a resource taught: a correction, a note, a gap an agent saw. Gathered with consent, it is data, never an instruction; its owner keeps it — it becomes a test case — or drops it (doctrine D-053).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "resource",
      "source",
      "observed",
      "consent",
      "state"
    ],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^lsn_[0-9A-Za-z_-]{8,64}$"
      },
      "resource": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "skill",
              "agent",
              "app"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "source": {
        "description": "correction: a person corrected a draft. note: a person noted it. agent: an agent saw a gap.",
        "enum": [
          "correction",
          "note",
          "agent"
        ]
      },
      "observed": {
        "description": "What was seen, as said.",
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "proposal": {
        "description": "What could change in the resource.",
        "type": "string",
        "maxLength": 1000
      },
      "case": {
        "description": "The situation it came from, which becomes a test case if kept.",
        "type": "string",
        "maxLength": 1000
      },
      "consent": {
        "description": "The person agreed to share it; nothing confidential travels unless generalized.",
        "const": true
      },
      "state": {
        "enum": [
          "waiting",
          "kept",
          "dropped"
        ]
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
      "client": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200,
        "description": "The app's client id at the Compte Kete (optional, added in v1: additive; spec 049): a center accepts the app's own tokens for an organization whose registry holds it."
      },
      "permissions": {
        "type": "array",
        "description": "The permissions the app checks (optional, added in v1: additive; spec 049), each with its words for people and the Compte Kete roles that hold it by default. A center lets an administrator grant them to roles and positions.",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name",
            "label",
            "roles"
          ],
          "properties": {
            "name": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$"
            },
            "label": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                }
              }
            },
            "description": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                }
              }
            },
            "roles": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "enum": [
                  "owner",
                  "admin",
                  "member"
                ]
              }
            }
          }
        }
      },
      "emits": {
        "type": "array",
        "description": "The business events the app announces (optional, added in v1: additive; spec 049): identifiers and facts only, the rest read at its API under the reader's rights.",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "type",
            "description"
          ],
          "properties": {
            "type": {
              "type": "string",
              "maxLength": 100,
              "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
            },
            "description": {
              "type": "string",
              "minLength": 1,
              "maxLength": 1000
            },
            "classification": {
              "enum": [
                "public",
                "internal",
                "confidential",
                "secret"
              ],
              "description": "How far the data may travel. public: anyone; internal (the default): the organization's people with the permission; confidential: a need to know, never in a shared briefing; secret: never sent to a model, a shared briefing nor a notification's text."
            },
            "data": {
              "type": "object",
              "description": "The JSON Schema of the event's data."
            }
          }
        }
      },
      "subjects": {
        "type": "array",
        "description": "What the app asks a center to decide (optional, added in v1: additive; spec 049): a purchase, a leave. The center's circuits find the approver.",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name",
            "label"
          ],
          "properties": {
            "name": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{0,62}$"
            },
            "label": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                }
              }
            },
            "measure": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 300
                }
              }
            }
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
      },
      "question": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "fr",
          "en"
        ],
        "properties": {
          "fr": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "en": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        },
        "description": "The question the app answers on its home (optional, added in v1: additive; doctrine D-048): « Combien ai-je vraiment, projet par projet ? »."
      },
      "places": {
        "type": "array",
        "description": "The places of the app, in the order of its sidebar (optional, added in v1: additive; spec 099). A center or the shell builds the menu and Ctrl K from them; each is opened at the app's address followed by its path.",
        "maxItems": 40,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "label",
            "path"
          ],
          "properties": {
            "id": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{0,40}$"
            },
            "label": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                }
              }
            },
            "path": {
              "type": "string",
              "pattern": "^/[A-Za-z0-9/_-]*$",
              "maxLength": 200
            },
            "section": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 80
                }
              },
              "description": "The heading the place sits under."
            },
            "icon": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9-]{0,30}$",
              "description": "A name of the design's icon set."
            },
            "permission": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$",
              "description": "Shown only to who holds it."
            }
          }
        }
      },
      "metrics": {
        "type": "array",
        "description": "The figures the app declares (optional, added in v1: additive; spec 099), read at its API under the reader's rights.",
        "items": {
          "$ref": "metric.v1.schema.json"
        }
      },
      "objects": {
        "type": "array",
        "description": "The kinds of objects the app owns (optional, added in v1: additive; doctrine D-062, kete-core spec 142): their states, axes, named links and where they open. The app says its objects to the center's index (`object.v1`); the rest stays at the app.",
        "maxItems": 40,
        "items": {
          "$ref": "object-type.v1.schema.json"
        }
      }
    }
  },
  "message.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/message.v1.schema.json",
    "title": "Message",
    "description": "One thing said in a thread (doctrine D-057), by a person, an agent, or a contact through a channel. Never rewritten: an edit is a new message naming the one it replaces. « for action » asks someone to act and becomes a holding; « for information » tells.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "thread",
      "author",
      "text",
      "for",
      "via",
      "at"
    ],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^msg_[0-9A-Za-z_-]{8,70}$"
      },
      "thread": {
        "type": "string",
        "pattern": "^thr_[0-9A-Za-z_-]{8,70}$"
      },
      "author": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "person",
              "agent",
              "contact"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "text": {
        "type": "string",
        "maxLength": 20000
      },
      "attachments": {
        "type": "array",
        "maxItems": 20,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "name"
          ],
          "properties": {
            "id": {
              "description": "The file kept in the product's storage.",
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "name": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "media_type": {
              "type": "string",
              "maxLength": 100
            },
            "bytes": {
              "type": "integer",
              "minimum": 0
            },
            "duration_ms": {
              "description": "A voice note's or a video's length (spec 140).",
              "type": "integer",
              "minimum": 0
            },
            "transcript": {
              "description": "A voice note's words, once transcribed (spec 140); searched like text.",
              "type": "string",
              "maxLength": 20000
            }
          }
        }
      },
      "for": {
        "enum": [
          "action",
          "information"
        ]
      },
      "to": {
        "description": "Who must act, for a message « for action »; the thread's holder otherwise.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "person",
              "agent"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "via": {
        "enum": [
          "kete",
          "whatsapp",
          "mail",
          "telegram",
          "form"
        ]
      },
      "visibility": {
        "description": "internal: between the organization's people and agents. outside: said to the thread's contacts through their channel (a contact's own words are outside). Absent: internal.",
        "enum": [
          "internal",
          "outside"
        ]
      },
      "reply_to": {
        "type": "string",
        "pattern": "^msg_[0-9A-Za-z_-]{8,70}$"
      },
      "edited_from": {
        "description": "The message this one replaces; the original is kept.",
        "type": "string",
        "pattern": "^msg_[0-9A-Za-z_-]{8,70}$"
      },
      "moved_from": {
        "description": "The message this one was moved from; the original stays, saying where it went.",
        "type": "string",
        "pattern": "^msg_[0-9A-Za-z_-]{8,70}$"
      },
      "mentions": {
        "type": "array",
        "maxItems": 50,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "id"
          ],
          "properties": {
            "kind": {
              "enum": [
                "person",
                "agent"
              ]
            },
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
            }
          }
        }
      },
      "references": {
        "description": "The objects it cites with « # » (spec 140): a project, a third party, a ticket, an invoice… each shown in its state of now, to who may read it.",
        "type": "array",
        "maxItems": 20,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "id"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "minLength": 1,
              "maxLength": 60
            },
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "app": {
              "description": "The app the object lives in; absent: the center.",
              "type": "string",
              "minLength": 1,
              "maxLength": 60
            }
          }
        }
      },
      "only_for": {
        "description": "The one person who reads it (spec 140): Kete's answer that uses what not every member may read. Absent: every member.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "const": "person"
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "at": {
        "type": "string",
        "format": "date-time"
      }
    }
  },
  "metric-reading.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/metric-reading.v1.schema.json",
    "title": "MetricReading",
    "description": "A figure an app declared (metric.v1), read at a moment for a reader, under her rights (doctrine D-052): its value over a period, the value of the period before when she compares, and the filters it applied. A board, an app's home and a summary show readings; a summary keeps them frozen.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "value",
      "at"
    ],
    "properties": {
      "name": {
        "description": "The metric's name, as its app declares it: « finance.available ».",
        "type": "string",
        "maxLength": 100,
        "pattern": "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$"
      },
      "value": {
        "description": "In the metric's unit; money in the currency's smallest unit. Null: nothing to count, or the reader may not read it (`denied`).",
        "type": [
          "number",
          "null"
        ]
      },
      "previous": {
        "description": "The value over the period just before, of the same length, when the reader compares.",
        "type": [
          "number",
          "null"
        ]
      },
      "currency": {
        "description": "For a metric in money: ISO 4217.",
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      },
      "period": {
        "description": "The days it covers, both included; none for « everything ».",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "from",
          "to"
        ],
        "properties": {
          "from": {
            "type": "string",
            "format": "date"
          },
          "to": {
            "type": "string",
            "format": "date"
          }
        }
      },
      "filter": {
        "description": "The filters it applied — only those on its axes; a filter asked on another axis is left out, and the reader is told the figure is not filtered.",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "project_id": {
            "type": "string",
            "pattern": "^prj_[0-9a-f-]{8,64}$"
          },
          "party_id": {
            "type": "string",
            "pattern": "^pty_[0-9a-f-]{8,64}$"
          },
          "person_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "unit_id": {
            "type": "string",
            "pattern": "^unt_[0-9a-f-]{8,64}$"
          }
        }
      },
      "at": {
        "description": "When it was read.",
        "type": "string",
        "format": "date-time"
      },
      "denied": {
        "description": "True: the reader may not read this figure; its value is null.",
        "type": "boolean"
      },
      "missing": {
        "description": "True: its source did not answer when it was read; its value is null. A figure missing is shown missing, never as zero (doctrine D-062, R17; added in v1: additive).",
        "type": "boolean"
      }
    }
  },
  "metric.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/metric.v1.schema.json",
    "title": "Metric",
    "description": "A figure an app declares in its manifest, computed by the app's code and read under the reader's rights (doctrine D-052). Boards, the apps' homes and summaries compose metrics; no one writes a query. Its axes are the center's references, so that a filter « project = X » applies to every app's figures at once.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "label",
      "unit",
      "better"
    ],
    "properties": {
      "name": {
        "description": "The app's area, then the figure: « finance.available », « team.absences ».",
        "type": "string",
        "maxLength": 100,
        "pattern": "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$"
      },
      "label": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "fr",
          "en"
        ],
        "properties": {
          "fr": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "en": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          }
        }
      },
      "description": {
        "description": "How it is computed, in a sentence a person reads beside « Pourquoi ? ».",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "fr",
          "en"
        ],
        "properties": {
          "fr": {
            "type": "string",
            "minLength": 1,
            "maxLength": 400
          },
          "en": {
            "type": "string",
            "minLength": 1,
            "maxLength": 400
          }
        }
      },
      "unit": {
        "description": "money: in the currency's smallest unit, with its currency. count, days, hours, percent: plain numbers.",
        "enum": [
          "money",
          "count",
          "days",
          "hours",
          "percent"
        ]
      },
      "better": {
        "description": "Whether a rise is good news (up), bad news (down), or neither (none).",
        "enum": [
          "up",
          "down",
          "none"
        ]
      },
      "axes": {
        "description": "What it can be split or filtered by.",
        "type": "array",
        "uniqueItems": true,
        "items": {
          "enum": [
            "project",
            "party",
            "unit",
            "person",
            "period"
          ]
        }
      }
    }
  },
  "money-fact.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/money-fact.v1.schema.json",
    "title": "MoneyFact",
    "description": "A fact of money an app says to its center, with the token of the person who made it true. Sent again under the same key, it replaces what was said: an app keeps the amount of an invoice at what is still due, and of a commitment at what is still to pay. The center adds the facts up by project; it executes no payment and keeps no ledger.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "kind",
      "amount",
      "currency",
      "occurred_on",
      "label"
    ],
    "properties": {
      "key": {
        "description": "The app's own key for this fact: one fact per app and key.",
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "kind": {
        "description": "invoiced: asked of a third party and still due. received: money that came in. committed: promised to a third party and still to pay (an order placed, a pay due). spent: money that went out.",
        "enum": [
          "invoiced",
          "received",
          "committed",
          "spent"
        ]
      },
      "amount": {
        "description": "In the currency's smallest unit (francs for XOF, cents for EUR): an integer, never negative.",
        "type": "integer",
        "minimum": 0
      },
      "currency": {
        "description": "ISO 4217.",
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      },
      "occurred_on": {
        "description": "The day it became true.",
        "type": "string",
        "format": "date"
      },
      "label": {
        "description": "What it is, as a person reads it: « Facture F-0412 », « Bon de commande BC-0031 ».",
        "type": "string",
        "minLength": 1,
        "maxLength": 300
      },
      "project_id": {
        "description": "The project of the center it belongs to; none for the organization's own running.",
        "type": "string",
        "pattern": "^prj_[0-9a-f-]{8,64}$"
      },
      "post": {
        "description": "The post of the project's budget it counts against, by its name.",
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "party_id": {
        "description": "The third party of the center it concerns.",
        "type": "string",
        "pattern": "^pty_[0-9a-f-]{8,64}$"
      },
      "href": {
        "description": "Where the piece that proves it is read, in the app.",
        "type": "string",
        "format": "uri",
        "maxLength": 600
      },
      "object": {
        "description": "The object it is about (optional, added in v1: additive; kete-core spec 142): it inherits that object's axes (D-062, R2).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{1,40}$"
          },
          "id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
          }
        }
      }
    }
  },
  "object-type.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/object-type.v1.schema.json",
    "title": "ObjectType",
    "description": "A kind of object, declared once by its owner — an app in its manifest, or the center for its own references (doctrine D-062, R1 and R3; ADR 0014): its states, which of the four axes it carries, its named links to other kinds, where it opens. The center keeps an index of the objects of every declared kind, never their data.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "label",
      "states"
    ],
    "properties": {
      "kind": {
        "description": "The kind's name, unique in an organization: `ticket`, `invoice`, `asset`. The center's references are `party`, `project`, `unit`, `place` and `asset`.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{1,40}$"
      },
      "label": {
        "description": "What one of them is called, and several.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "fr",
          "en"
        ],
        "properties": {
          "fr": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "en": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "fr_plural": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "en_plural": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          }
        }
      },
      "icon": {
        "description": "One of the design's icon names, for its card and its « # » chip.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]{1,30}$"
      },
      "states": {
        "description": "Its states, in the order of its life. A closed state ends it: its thread is put away (R12).",
        "type": "array",
        "minItems": 1,
        "maxItems": 20,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "label"
          ],
          "properties": {
            "id": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{0,40}$"
            },
            "label": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 60
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 60
                }
              }
            },
            "tone": {
              "description": "How the state reads at a glance: a tag's tint, never a left border.",
              "enum": [
                "neutral",
                "ok",
                "verify",
                "error",
                "info"
              ]
            },
            "closed": {
              "type": "boolean"
            }
          }
        }
      },
      "axes": {
        "description": "Which of the four axes its objects carry (R2). An object says the value of each; facts about it inherit them.",
        "type": "array",
        "uniqueItems": true,
        "items": {
          "enum": [
            "project",
            "party",
            "unit",
            "person"
          ]
        }
      },
      "links": {
        "description": "Its named links to other kinds: a project produces assets, a contract covers them, a ticket concerns one.",
        "type": "array",
        "maxItems": 30,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "relation",
            "to"
          ],
          "properties": {
            "relation": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{1,40}$"
            },
            "to": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{1,40}$"
            },
            "label": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 60
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 60
                }
              }
            },
            "inverse": {
              "description": "The words read from the other side: « produit » when an asset says « produit par ».",
              "type": "object",
              "additionalProperties": false,
              "required": [
                "fr",
                "en"
              ],
              "properties": {
                "fr": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 60
                },
                "en": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 60
                }
              }
            }
          }
        }
      },
      "href": {
        "description": "Where one opens: an https address, or a path of its owner, with `{id}` for the object's identifier.",
        "type": "string",
        "maxLength": 300,
        "pattern": "\\{id\\}"
      },
      "classification": {
        "description": "How far its title and state may travel in the index. internal (the default): the organization's people who may read it by its axes; confidential: only its person, its project's team and who holds the kind's permission.",
        "enum": [
          "internal",
          "confidential"
        ]
      }
    }
  },
  "object.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/object.v1.schema.json",
    "title": "KeteObject",
    "description": "One object as its owner says it to the center's index (doctrine D-062, R1, R2, R15; ADR 0014): what finds it, cites it and rights it — its title, its state, its four axes, its named links, where it opens. Never its data: the rest is read at its owner, under the reader's rights. Said again, it replaces what was said; said with `gone`, it leaves the index.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "id",
      "title"
    ],
    "properties": {
      "kind": {
        "description": "A kind its owner declared (`object-type.v1`).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{1,40}$"
      },
      "id": {
        "description": "Its identifier at its owner: stable, unique within its kind.",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
      },
      "title": {
        "description": "What a person reads in a list, a « # » chip, a search: « Mini-centrale · École de Tsévié », « T-0412 · Onduleur hors ligne ».",
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "state": {
        "description": "One of its kind's states.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,40}$"
      },
      "project_id": {
        "description": "The project of the center it belongs to.",
        "type": "string",
        "pattern": "^prj_[0-9a-f-]{8,64}$"
      },
      "party_id": {
        "description": "The third party of the center it concerns.",
        "type": "string",
        "pattern": "^pty_[0-9a-f-]{8,64}$"
      },
      "unit_id": {
        "description": "The unit of the structure it belongs to — a service, an agency, a site.",
        "type": "string",
        "pattern": "^unt_[0-9a-f-]{8,64}$"
      },
      "person_id": {
        "description": "The person who answers for it: an account's user id.",
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "links": {
        "description": "Its named links to other objects, by a relation its kind declares.",
        "type": "array",
        "maxItems": 50,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "relation",
            "kind",
            "id"
          ],
          "properties": {
            "relation": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{1,40}$"
            },
            "kind": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{1,40}$"
            },
            "id": {
              "type": "string",
              "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
            }
          }
        }
      },
      "href": {
        "description": "Where it opens, when its kind's pattern does not say it.",
        "type": "string",
        "maxLength": 600
      },
      "updated_at": {
        "description": "When its owner last changed it: an older saying never replaces a newer one.",
        "type": "string",
        "format": "date-time"
      },
      "gone": {
        "description": "True takes it out of the index: deleted or no longer said by its owner.",
        "type": "boolean"
      }
    }
  },
  "policy-decision.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/policy-decision.v1.schema.json",
    "title": "PolicyDecision",
    "description": "What the policy engine decided for a gesture (doctrine D-058, spec 112): allowed, to approve by someone, or refused — with the policies that decided it, their versions and why. A refusal wins over an approval, an approval over an allowance. What the policies on trial would have said is kept beside, never enforced.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "effect",
      "policies",
      "trial"
    ],
    "properties": {
      "effect": {
        "enum": [
          "allow",
          "approve",
          "refuse"
        ]
      },
      "approvers": {
        "description": "Who must approve, when the effect is approve: the relations or roles of the policies that asked.",
        "type": "array",
        "uniqueItems": true,
        "items": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80
        }
      },
      "policies": {
        "description": "The policies that decided. Empty for a refusal means nothing gave the power.",
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "version",
            "effect",
            "reason"
          ],
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 80
            },
            "version": {
              "type": "integer",
              "minimum": 1
            },
            "effect": {
              "enum": [
                "allow",
                "approve",
                "refuse"
              ]
            },
            "reason": {
              "description": "The policy's sentence, as the person reads it on the card.",
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          }
        }
      },
      "trial": {
        "description": "The policies on trial that would have refused or asked, had they been active.",
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "version",
            "effect",
            "reason"
          ],
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 80
            },
            "version": {
              "type": "integer",
              "minimum": 1
            },
            "effect": {
              "enum": [
                "allow",
                "approve",
                "refuse"
              ]
            },
            "reason": {
              "description": "The policy's sentence, as the person reads it on the card.",
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          }
        }
      }
    }
  },
  "policy.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/policy.v1.schema.json",
    "title": "Policy",
    "description": "A rule of the organization, written as a sentence by a person and kept as a Cedar rule (doctrine D-058, spec 112). It decides what may be done at all (authority), or what needs someone's approval (approval). A new one observes first (trial): its decisions are journaled, never enforced. Each change is a new version.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "sentence",
      "rule",
      "set",
      "owner",
      "version",
      "status"
    ],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_-]*(\\.[a-z0-9_-]+)*$",
        "maxLength": 80
      },
      "sentence": {
        "description": "The policy as the organization says it: « Un agent n'écrit pas aux clients après 19 h ».",
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "rule": {
        "description": "Its Cedar rule: one permit or forbid.",
        "type": "string",
        "minLength": 1,
        "maxLength": 4000
      },
      "set": {
        "description": "authority: a forbid refuses, a permit allows. approval: a permit means the gesture needs the approver's approval.",
        "enum": [
          "authority",
          "approval"
        ]
      },
      "approver": {
        "description": "Who approves, for an approval policy: a relation or a role the product resolves (manager, project.holder, direction, on_behalf_of).",
        "type": "string",
        "minLength": 1,
        "maxLength": 80
      },
      "owner": {
        "description": "Who answers for it: a person's id.",
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "version": {
        "type": "integer",
        "minimum": 1
      },
      "status": {
        "description": "active: enforced. trial: observed, never enforced. off: kept, not read.",
        "enum": [
          "active",
          "trial",
          "off"
        ]
      }
    }
  },
  "proposal-set.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/proposal-set.v1.schema.json",
    "title": "ProposalSet",
    "description": "Several things an agent proposes at once — the evening's tidying, a week's plan, what a document said — each ticked or not by the person, applied together by one gesture, and undone together (doctrine D-051). Nothing in it is true until applied: each item names the gesture that will make it true, with its level.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "origin",
      "for",
      "items"
    ],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^pps_[0-9A-Za-z_-]{8,64}$"
      },
      "origin": {
        "description": "closure: the evening's note. plan: a plan of the day or the week. intake: what was received. agent: an agent's run.",
        "enum": [
          "closure",
          "plan",
          "intake",
          "agent"
        ]
      },
      "for": {
        "description": "The person who decides.",
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 30,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "key",
            "gesture",
            "label",
            "level"
          ],
          "properties": {
            "key": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
            },
            "gesture": {
              "description": "postpone, close, block (a time), assign (to a colleague, who may refuse), correct (a record), remind, lesson (proposed to a skill's owner), create.",
              "enum": [
                "postpone",
                "close",
                "block",
                "assign",
                "correct",
                "remind",
                "lesson",
                "create"
              ]
            },
            "label": {
              "description": "What will happen, as the person reads it.",
              "type": "string",
              "minLength": 1,
              "maxLength": 300
            },
            "reason": {
              "description": "Why it is proposed, in a sentence.",
              "type": "string",
              "maxLength": 300
            },
            "level": {
              "description": "The autonomy level of the gesture that applies it (1 to 4).",
              "type": "integer",
              "minimum": 1,
              "maximum": 4
            },
            "capability": {
              "description": "The capability that applies it, when an app does.",
              "type": "string",
              "maxLength": 100
            },
            "ticked": {
              "description": "Whether it is ticked when shown; the person changes it.",
              "type": "boolean"
            },
            "input": {
              "description": "What the capability is called with, once applied (optional, added in v1: additive; spec 104).",
              "type": "object"
            }
          }
        }
      }
    }
  },
  "resource.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/resource.v1.schema.json",
    "title": "Resource",
    "description": "A skill, an agent or an app in its lifecycle: created, used, learning, evaluated, promoted one tier at a time with a review by its risk (doctrine D-053).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "id",
      "name",
      "owner",
      "version",
      "tier"
    ],
    "properties": {
      "kind": {
        "enum": [
          "skill",
          "agent",
          "app"
        ]
      },
      "id": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "owner": {
        "description": "The person who owns it and keeps or drops its lessons.",
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "version": {
        "type": "string",
        "pattern": "^\\d+\\.\\d+(\\.\\d+)?$"
      },
      "tier": {
        "description": "Who may use it: me, my team, my unit, the whole organization.",
        "enum": [
          "me",
          "team",
          "unit",
          "organization"
        ]
      },
      "review": {
        "description": "The review asked to reach the next tier.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "state",
          "risk"
        ],
        "properties": {
          "state": {
            "enum": [
              "asked",
              "approved",
              "refused"
            ]
          },
          "risk": {
            "enum": [
              "low",
              "medium",
              "high"
            ]
          },
          "by": {
            "description": "The role that reviews.",
            "type": "string",
            "maxLength": 100
          }
        }
      },
      "cases": {
        "description": "Its test cases, and how many the current version passes.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "total",
          "passed"
        ],
        "properties": {
          "total": {
            "type": "integer",
            "minimum": 0
          },
          "passed": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    }
  },
  "routing.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/routing.v1.schema.json",
    "title": "Routing",
    "description": "Where the router tied something received from outside (doctrine D-056): its object, its thread, the holding it made — by a rule, by the model's intent with its confidence, or by a person. Under the threshold it is not guessed: a card « à classer » asks a person.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "received",
      "intent",
      "confidence",
      "by"
    ],
    "properties": {
      "received": {
        "description": "What was received: its channel and its own reference there.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "via",
          "ref"
        ],
        "properties": {
          "via": {
            "enum": [
              "whatsapp",
              "mail",
              "telegram",
              "form"
            ]
          },
          "ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300
          }
        }
      },
      "object": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "thread": {
        "type": "string",
        "pattern": "^thr_[0-9A-Za-z_-]{8,70}$"
      },
      "holding": {
        "type": "string",
        "pattern": "^hld_[0-9A-Za-z_-]{4,70}$"
      },
      "intent": {
        "description": "What it is about, in the product's words: incident, quote_request, invoice_request…",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,59}$"
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "by": {
        "description": "rule: a known number, address or thread. model: its intent above the threshold. person: a card « à classer » settled.",
        "enum": [
          "rule",
          "model",
          "person"
        ]
      },
      "asked": {
        "description": "The holding of the card « à classer », when a person must decide.",
        "type": "string",
        "pattern": "^hld_[0-9A-Za-z_-]{4,70}$"
      }
    }
  },
  "thread.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://kete.africa/contracts/thread.v1.schema.json",
    "title": "Thread",
    "description": "Where people talk about one thing (doctrine D-056, D-057): born with its object and put away when it closes, a group from the structure or created, a direct exchange, or a person's thread with Kete. It always has a holder; its members say who knew, and since when.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "kind",
      "title",
      "holder",
      "state",
      "opened_at"
    ],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^thr_[0-9A-Za-z_-]{8,70}$"
      },
      "kind": {
        "description": "object: born with its object. group: a unit, a project's team, a board, or created. direct: between two. kete: a person and Kete Intelligence.",
        "enum": [
          "object",
          "group",
          "direct",
          "kete"
        ]
      },
      "object": {
        "description": "What the thread is about; required for an object thread.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "holder": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "person",
              "agent"
            ]
          },
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          }
        }
      },
      "members": {
        "type": "array",
        "maxItems": 500,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "since"
          ],
          "properties": {
            "kind": {
              "description": "contact: someone outside, reached through a channel.",
              "enum": [
                "person",
                "agent",
                "contact"
              ]
            },
            "id": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
            },
            "role": {
              "description": "member: takes part. subscriber: is told, follows.",
              "enum": [
                "member",
                "subscriber"
              ],
              "default": "member"
            },
            "since": {
              "type": "string",
              "format": "date-time"
            },
            "until": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      },
      "address": {
        "description": "Its own address for replies by mail.",
        "type": "string",
        "maxLength": 200
      },
      "retention": {
        "description": "The policy that keeps or puts it away.",
        "type": "string",
        "maxLength": 80
      },
      "state": {
        "enum": [
          "open",
          "closed"
        ]
      },
      "opened_at": {
        "type": "string",
        "format": "date-time"
      },
      "closed_at": {
        "type": "string",
        "format": "date-time"
      }
    }
  }
} as const;
