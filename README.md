# mcp-ukhsa

UK Health Security Agency (UKHSA) data dashboard MCP — keyless.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Ukhsa data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
