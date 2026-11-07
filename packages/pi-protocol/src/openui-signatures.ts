// @generated — do not edit

import type { PromptSpec } from "@openuidev/lang-core"

export const openUIPromptSpec = {
  "components": {
    "Root": {
      "signature": "Root(children?: any)",
      "description": "The root container for the generated UI. Must be used as the top-level component."
    },
    "Stack": {
      "signature": "Stack(children?: any, direction?: \"row\" | \"column\", gap?: \"sm\" | \"md\" | \"lg\" | \"xl\")",
      "description": "A flexbox layout component for stacking children vertically or horizontally."
    },
    "Grid": {
      "signature": "Grid(children?: any, cols?: number, gap?: \"sm\" | \"md\" | \"lg\" | \"xl\")",
      "description": "A CSS grid layout component."
    },
    "Group": {
      "signature": "Group(children?: any, gap?: \"sm\" | \"md\" | \"lg\" | \"xl\")",
      "description": "A wrapping horizontal group for badges, buttons, or short items."
    },
    "Divider": {
      "signature": "Divider(label?: string)",
      "description": "Horizontal divider with an optional label."
    },
    "Heading": {
      "signature": "Heading(text: string, level?: number)",
      "description": "Section heading text."
    },
    "Text": {
      "signature": "Text(text: string, tone?: \"default\" | \"muted\" | \"success\" | \"warning\" | \"danger\", size?: \"sm\" | \"md\" | \"lg\")",
      "description": "Short body text for cards, captions, and summaries."
    },
    "Button": {
      "signature": "Button(label: string, action?: ActionExpression, variant?: \"default\" | \"destructive\" | \"outline\" | \"secondary\" | \"ghost\" | \"link\")",
      "description": "A button that triggers interactive actions or conversational updates."
    },
    "Input": {
      "signature": "Input(name: string, value: $binding<string>, placeholder?: string, type?: \"text\" | \"email\" | \"number\" | \"password\" | \"search\", disabled?: boolean)",
      "description": "An interactive, state-bound text input."
    },
    "Card": {
      "signature": "Card(title: string, content?: any, tone?: \"default\" | \"info\" | \"success\" | \"warning\" | \"danger\", width?: \"compact\" | \"normal\" | \"wide\" | \"full\")",
      "description": "A chat-sized card container for structured information."
    },
    "Badge": {
      "signature": "Badge(label: string, tone?: \"default\" | \"info\" | \"success\" | \"warning\" | \"danger\")",
      "description": "Small status badge."
    },
    "Callout": {
      "signature": "Callout(title: string, content?: any, tone?: \"default\" | \"info\" | \"success\" | \"warning\" | \"danger\")",
      "description": "Highlighted note, warning, success, or error message."
    },
    "KeyValue": {
      "signature": "KeyValue(label: string, value: string)",
      "description": "A single label/value row."
    },
    "Metric": {
      "signature": "Metric(label: string, value: string, trend?: string, tone?: \"default\" | \"info\" | \"success\" | \"warning\" | \"danger\")",
      "description": "A compact KPI metric card."
    },
    "ProgressBar": {
      "signature": "ProgressBar(label: string, value: number)",
      "description": "Progress indicator with a label."
    },
    "List": {
      "signature": "List(items: string[], ordered?: boolean)",
      "description": "Bulleted or numbered text list."
    },
    "CodeBlock": {
      "signature": "CodeBlock(code: string, language?: string)",
      "description": "Short preformatted code or command output."
    },
    "Table": {
      "signature": "Table(columns: string[], rows: string[][])",
      "description": "Small data table for comparisons and summaries."
    },
    "BarChart": {
      "signature": "BarChart(title: string, description?: string, xAxisKey: string, series: {dataKey: string, label: string}[], data: Record<string, string | number>[])",
      "description": "A bar chart for visualizing comparisons or trends using explicitly provided data points."
    },
    "Select": {
      "signature": "Select(name: string, value: $binding<string>, options: {value: string, label: string, disabled?: boolean}[], placeholder?: string)",
      "description": "An interactive dropdown selector with reactive state binding."
    },
    "Switch": {
      "signature": "Switch(name: string, checked: $binding<boolean>, label?: string, disabled?: boolean)",
      "description": "A toggle switch component bound to a boolean reactive state."
    },
    "Modal": {
      "signature": "Modal(name: string, open: $binding<boolean>, title: string, content?: any)",
      "description": "An overlay dialog container bound to a boolean reactive state."
    }
  },
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "Root": {
        "$ref": "#/$defs/Root"
      },
      "Stack": {
        "$ref": "#/$defs/Stack"
      },
      "Grid": {
        "$ref": "#/$defs/Grid"
      },
      "Group": {
        "$ref": "#/$defs/Group"
      },
      "Divider": {
        "$ref": "#/$defs/Divider"
      },
      "Heading": {
        "$ref": "#/$defs/Heading"
      },
      "Text": {
        "$ref": "#/$defs/Text"
      },
      "Button": {
        "$ref": "#/$defs/Button"
      },
      "Input": {
        "$ref": "#/$defs/Input"
      },
      "Card": {
        "$ref": "#/$defs/Card"
      },
      "Badge": {
        "$ref": "#/$defs/Badge"
      },
      "Callout": {
        "$ref": "#/$defs/Callout"
      },
      "KeyValue": {
        "$ref": "#/$defs/KeyValue"
      },
      "Metric": {
        "$ref": "#/$defs/Metric"
      },
      "ProgressBar": {
        "$ref": "#/$defs/ProgressBar"
      },
      "List": {
        "$ref": "#/$defs/List"
      },
      "CodeBlock": {
        "$ref": "#/$defs/CodeBlock"
      },
      "Table": {
        "$ref": "#/$defs/Table"
      },
      "BarChart": {
        "$ref": "#/$defs/BarChart"
      },
      "Select": {
        "$ref": "#/$defs/Select"
      },
      "Switch": {
        "$ref": "#/$defs/Switch"
      },
      "Modal": {
        "$ref": "#/$defs/Modal"
      }
    },
    "required": [
      "Root",
      "Stack",
      "Grid",
      "Group",
      "Divider",
      "Heading",
      "Text",
      "Button",
      "Input",
      "Card",
      "Badge",
      "Callout",
      "KeyValue",
      "Metric",
      "ProgressBar",
      "List",
      "CodeBlock",
      "Table",
      "BarChart",
      "Select",
      "Switch",
      "Modal"
    ],
    "additionalProperties": false,
    "$defs": {
      "Root": {
        "type": "object",
        "properties": {
          "children": {}
        },
        "additionalProperties": false,
        "description": "The root container for the generated UI. Must be used as the top-level component."
      },
      "Stack": {
        "type": "object",
        "properties": {
          "children": {},
          "direction": {
            "default": "column",
            "type": "string",
            "enum": [
              "row",
              "column"
            ]
          },
          "gap": {
            "default": "md",
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg",
              "xl"
            ]
          }
        },
        "required": [
          "direction",
          "gap"
        ],
        "additionalProperties": false,
        "description": "A flexbox layout component for stacking children vertically or horizontally."
      },
      "Grid": {
        "type": "object",
        "properties": {
          "children": {},
          "cols": {
            "default": 2,
            "type": "number",
            "minimum": 1,
            "maximum": 12
          },
          "gap": {
            "default": "md",
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg",
              "xl"
            ]
          }
        },
        "required": [
          "cols",
          "gap"
        ],
        "additionalProperties": false,
        "description": "A CSS grid layout component."
      },
      "Group": {
        "type": "object",
        "properties": {
          "children": {},
          "gap": {
            "default": "md",
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg",
              "xl"
            ]
          }
        },
        "required": [
          "gap"
        ],
        "additionalProperties": false,
        "description": "A wrapping horizontal group for badges, buttons, or short items."
      },
      "Divider": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          }
        },
        "additionalProperties": false,
        "description": "Horizontal divider with an optional label."
      },
      "Heading": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string"
          },
          "level": {
            "default": 3,
            "type": "integer",
            "minimum": 1,
            "maximum": 4
          }
        },
        "required": [
          "text",
          "level"
        ],
        "additionalProperties": false,
        "description": "Section heading text."
      },
      "Text": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string"
          },
          "tone": {
            "default": "default",
            "type": "string",
            "enum": [
              "default",
              "muted",
              "success",
              "warning",
              "danger"
            ]
          },
          "size": {
            "default": "md",
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg"
            ]
          }
        },
        "required": [
          "text",
          "tone",
          "size"
        ],
        "additionalProperties": false,
        "description": "Short body text for cards, captions, and summaries."
      },
      "Button": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "action": {
            "$ref": "#/$defs/ActionExpression"
          },
          "variant": {
            "default": "default",
            "type": "string",
            "enum": [
              "default",
              "destructive",
              "outline",
              "secondary",
              "ghost",
              "link"
            ]
          }
        },
        "required": [
          "label",
          "variant"
        ],
        "additionalProperties": false,
        "description": "A button that triggers interactive actions or conversational updates."
      },
      "ActionExpression": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "open_url"
              },
              "url": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "continue_conversation"
              },
              "context": {
                "type": "string"
              }
            },
            "required": [
              "type"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string"
              },
              "params": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {}
              }
            },
            "required": [
              "type"
            ],
            "additionalProperties": false
          }
        ]
      },
      "Input": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "value": {
            "type": "string"
          },
          "placeholder": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "text",
              "email",
              "number",
              "password",
              "search"
            ]
          },
          "disabled": {
            "default": false,
            "type": "boolean"
          }
        },
        "required": [
          "name",
          "value",
          "disabled"
        ],
        "additionalProperties": false,
        "description": "An interactive, state-bound text input."
      },
      "Card": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "content": {},
          "tone": {
            "default": "default",
            "type": "string",
            "enum": [
              "default",
              "info",
              "success",
              "warning",
              "danger"
            ]
          },
          "width": {
            "default": "normal",
            "type": "string",
            "enum": [
              "compact",
              "normal",
              "wide",
              "full"
            ]
          }
        },
        "required": [
          "title",
          "tone",
          "width"
        ],
        "additionalProperties": false,
        "description": "A chat-sized card container for structured information."
      },
      "Badge": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "tone": {
            "default": "default",
            "type": "string",
            "enum": [
              "default",
              "info",
              "success",
              "warning",
              "danger"
            ]
          }
        },
        "required": [
          "label",
          "tone"
        ],
        "additionalProperties": false,
        "description": "Small status badge."
      },
      "Callout": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "content": {},
          "tone": {
            "default": "default",
            "type": "string",
            "enum": [
              "default",
              "info",
              "success",
              "warning",
              "danger"
            ]
          }
        },
        "required": [
          "title",
          "tone"
        ],
        "additionalProperties": false,
        "description": "Highlighted note, warning, success, or error message."
      },
      "KeyValue": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "value": {
            "type": "string"
          }
        },
        "required": [
          "label",
          "value"
        ],
        "additionalProperties": false,
        "description": "A single label/value row."
      },
      "Metric": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "value": {
            "type": "string"
          },
          "trend": {
            "type": "string"
          },
          "tone": {
            "default": "default",
            "type": "string",
            "enum": [
              "default",
              "info",
              "success",
              "warning",
              "danger"
            ]
          }
        },
        "required": [
          "label",
          "value",
          "tone"
        ],
        "additionalProperties": false,
        "description": "A compact KPI metric card."
      },
      "ProgressBar": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "value": {
            "type": "number",
            "minimum": 0,
            "maximum": 100
          }
        },
        "required": [
          "label",
          "value"
        ],
        "additionalProperties": false,
        "description": "Progress indicator with a label."
      },
      "List": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "ordered": {
            "default": false,
            "type": "boolean"
          }
        },
        "required": [
          "items",
          "ordered"
        ],
        "additionalProperties": false,
        "description": "Bulleted or numbered text list."
      },
      "CodeBlock": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "language": {
            "type": "string"
          }
        },
        "required": [
          "code"
        ],
        "additionalProperties": false,
        "description": "Short preformatted code or command output."
      },
      "Table": {
        "type": "object",
        "properties": {
          "columns": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "rows": {
            "type": "array",
            "items": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "required": [
          "columns",
          "rows"
        ],
        "additionalProperties": false,
        "description": "Small data table for comparisons and summaries."
      },
      "BarChart": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "xAxisKey": {
            "type": "string"
          },
          "series": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "dataKey": {
                  "type": "string"
                },
                "label": {
                  "type": "string"
                }
              },
              "required": [
                "dataKey",
                "label"
              ],
              "additionalProperties": false
            }
          },
          "data": {
            "type": "array",
            "items": {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "type": [
                  "string",
                  "number"
                ]
              }
            }
          }
        },
        "required": [
          "title",
          "xAxisKey",
          "series",
          "data"
        ],
        "additionalProperties": false,
        "description": "A bar chart for visualizing comparisons or trends using explicitly provided data points."
      },
      "Select": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "value": {
            "type": "string"
          },
          "options": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "value": {
                  "type": "string"
                },
                "label": {
                  "type": "string"
                },
                "disabled": {
                  "type": "boolean"
                }
              },
              "required": [
                "value",
                "label"
              ],
              "additionalProperties": false
            }
          },
          "placeholder": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "value",
          "options"
        ],
        "additionalProperties": false,
        "description": "An interactive dropdown selector with reactive state binding."
      },
      "Switch": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "checked": {
            "type": "boolean"
          },
          "label": {
            "type": "string"
          },
          "disabled": {
            "default": false,
            "type": "boolean"
          }
        },
        "required": [
          "name",
          "checked",
          "disabled"
        ],
        "additionalProperties": false,
        "description": "A toggle switch component bound to a boolean reactive state."
      },
      "Modal": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "open": {
            "type": "boolean"
          },
          "title": {
            "type": "string"
          },
          "content": {}
        },
        "required": [
          "name",
          "open",
          "title"
        ],
        "additionalProperties": false,
        "description": "An overlay dialog container bound to a boolean reactive state."
      }
    }
  }
} as PromptSpec
