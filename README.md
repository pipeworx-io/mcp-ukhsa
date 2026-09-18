# mcp-ukhsa

UK Health Security Agency (UKHSA) data dashboard MCP — keyless.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `navigate` | Walk the UKHSA surveillance hierarchy one level at a time to discover valid values. Pass the levels you already know (in order: theme, sub_theme, topic, geography_type, geography) and you get back the list of options for the NEXT level. With no args it lists themes (e.g. infectious_disease, immunisation, climate_and_environment, medicines). With theme="infectious_disease" it lists sub_themes (respiratory, gastrointestinal, vaccine_preventable, ...). Continue down to topics (COVID-19, Influenza, Measles, ...), geography_types (Nation, NHS Region, ...), geographies (England, ...), and finally metrics. Each item has {name, link}. Feed the chosen name into the next-level arg, then call get_metric_data once you have all six. |
| `list_metrics` | Shortcut to list all available metric names for a fully-specified location — supply all five levels (theme, sub_theme, topic, geography_type, geography) at once rather than calling navigate iteratively. Returns metric names like "COVID-19_cases_casesByDay" ready to pass to get_metric_data.(theme, sub_theme, topic, geography_type, geography), without walking each level. Returns metric names like "COVID-19_cases_casesByDay" or "COVID-19_deaths_ONSByDay" ready to pass to get_metric_data. |
| `get_metric_data` | Pull the time series for one fully-specified UKHSA metric. Requires all six levels (theme, sub_theme, topic, geography_type, geography, metric). Returns paginated observations {count, next, previous, results[]} where each result has date, metric_value, year, month, epiweek, sex, age, stratum, geography_code, etc. Optionally filter by year and control page_size / page. Example: infectious_disease / respiratory / COVID-19 / Nation / England / COVID-19_cases_casesByDay. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "ukhsa": {
      "url": "https://gateway.pipeworx.io/ukhsa/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/ukhsa/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Ukhsa data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/navigate \
  -H 'Content-Type: application/json' \
  -d '{}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/navigate`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.
