# CustomerEQ MCP Server

MCP (Model Context Protocol) server that exposes the CustomerEQ CX-to-Loyalty platform as AI-callable tools.

## Tools (21)

### Surveys
| Tool | Description |
|------|-------------|
| `list_surveys` | List all surveys with types, statuses, response counts |
| `create_survey` | Create NPS/CSAT/CES/Custom survey |
| `get_survey` | Get survey detail with responses and sentiment |
| `update_survey_status` | Activate, pause, or close a survey |

### Analytics & CX
| Tool | Description |
|------|-------------|
| `get_cx_analytics` | NPS score, CSAT, CES, sentiment, clusters, anomalies |
| `get_loyalty_overview` | Total members, points issued/redeemed, ROI |
| `get_feedback_clusters` | Feedback theme clusters with trend data |
| `get_cluster_trend` | Daily volume time-series for a cluster |
| `get_anomalies` | Volume spikes, sentiment drops, new themes |
| `trigger_clustering` | Run batch clustering + anomaly detection |

### Loyalty Events
| Tool | Description |
|------|-------------|
| `ingest_event` | Submit CX event to loyalty pipeline |
| `list_events` | Recent loyalty events |

### Campaigns
| Tool | Description |
|------|-------------|
| `list_campaigns` | All campaigns with status and triggers |
| `create_campaign` | Create campaign with trigger conditions |
| `update_campaign_status` | Activate, pause, or close campaign |

### Members
| Tool | Description |
|------|-------------|
| `enroll_member` | Enroll member in loyalty program |
| `get_member_balance` | Points balance and recent events |
| `get_member` | Full member details |

### Programs
| Tool | Description |
|------|-------------|
| `list_programs` | All loyalty programs |
| `create_program` | Create loyalty program |
| `get_program` | Program details with earning rules |

## Setup

```bash
# Install dependencies
cd apps/mcp-server
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API URL and token
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CUSTOMEREQ_API_URL` | Base URL of CustomerEQ API | `http://localhost:4000` |
| `CUSTOMEREQ_API_TOKEN` | Bearer token for API auth | (empty) |

## Claude Code Configuration

Add to your Claude Code MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "customereq": {
      "command": "npx",
      "args": ["tsx", "apps/mcp-server/src/index.ts"],
      "cwd": "/path/to/CustomerEQ",
      "env": {
        "CUSTOMEREQ_API_URL": "http://localhost:4000",
        "CUSTOMEREQ_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Cursor Configuration

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "customereq": {
      "command": "npx",
      "args": ["tsx", "apps/mcp-server/src/index.ts"],
      "env": {
        "CUSTOMEREQ_API_URL": "http://localhost:4000",
        "CUSTOMEREQ_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Running Locally

```bash
# Start the API first
cd apps/api && pnpm dev

# Then start the MCP server (in another terminal)
cd apps/mcp-server && pnpm start
```

## Example Usage

Once connected, an AI agent can:

```
"Show me the NPS score and any feedback anomalies from the last 30 days"
→ calls get_cx_analytics

"Create an NPS survey called Post-Purchase Feedback"
→ calls create_survey

"What are the trending feedback clusters?"
→ calls get_feedback_clusters

"Set up a campaign to award 50 points when NPS < 7"
→ calls create_campaign
```
