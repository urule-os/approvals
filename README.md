# @urule/approvals

Approval workflow engine with rich metadata, routing rules, and audit trails.

Part of the [Urule](https://github.com/urule-os/urule) ecosystem — the open-source coordination layer for AI agents.

## Features

- **Full approval lifecycle** -- create, approve, deny, escalate, cancel, and request changes
- **Rich metadata** -- reasoning points, proposed changes, risk levels, impact summaries, access permissions, and governance context
- **Audit trails** -- every state transition is recorded with timestamp, actor, and detail
- **Routing rules** -- pattern-based rules that auto-assign approvers, set priority, or auto-approve matching actions
- **Human-readable request IDs** -- sequential `REQ-YYYYMMDD-NNN` format for easy reference
- **Query by workspace, run, user, or status** -- find pending approvals for a specific reviewer
- **Priority and risk levels** -- `low`, `medium`, `high`, `critical` for both priority and risk
- Temporal workflow placeholder ready for durable execution (in-memory by default)
- Fastify REST API with CORS support

## Quick Start

```bash
npm install
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

The server starts on port `3000` by default.

### Create an approval request

```bash
curl -X POST http://localhost:3000/api/v1/approvals \
  -H 'Content-Type: application/json' \
  -d '{
    "runId": "run-1",
    "workspaceId": "ws-1",
    "agentId": "agent-1",
    "action": "deploy:production",
    "reason": "Agent wants to deploy to production",
    "priority": "high",
    "title": "Production Deployment",
    "riskLevel": "high",
    "impactSummary": "Deploys latest changes to production environment",
    "reasoningPoints": [
      {"text": "All tests passing", "verified": true},
      {"text": "Staging validated", "verified": true}
    ]
  }'
```

### Approve

```bash
curl -X POST http://localhost:3000/api/v1/approvals/APPROVAL_ID/approve \
  -H 'Content-Type: application/json' \
  -d '{"decidedBy": "user-1", "note": "Looks good"}'
```

### List pending approvals for a user

```bash
curl http://localhost:3000/api/v1/users/user-1/approvals/pending
```

## API Endpoints

### Approvals

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/approvals` | List all approvals (optional `status_filter` query) |
| `POST` | `/api/v1/approvals` | Create an approval request |
| `GET` | `/api/v1/approvals/:approvalId` | Get approval by ID |
| `POST` | `/api/v1/approvals/:approvalId/approve` | Approve a pending request |
| `POST` | `/api/v1/approvals/:approvalId/deny` | Deny a pending request |
| `POST` | `/api/v1/approvals/:approvalId/reject` | Reject (alias for deny) |
| `POST` | `/api/v1/approvals/:approvalId/request-changes` | Request changes on a pending request |
| `POST` | `/api/v1/approvals/:approvalId/escalate` | Escalate to different reviewers |
| `POST` | `/api/v1/approvals/:approvalId/cancel` | Cancel a pending/escalated request |

### Queries

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/runs/:runId/approvals` | List approvals for a run |
| `GET` | `/api/v1/workspaces/:wsId/approvals` | List approvals for a workspace (optional `status` query) |
| `GET` | `/api/v1/users/:userId/approvals/pending` | List pending approvals assigned to a user |

### Routing Rules

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/approval-rules` | Create a routing rule |
| `GET` | `/api/v1/workspaces/:wsId/approval-rules` | List rules for a workspace |
| `DELETE` | `/api/v1/approval-rules/:ruleId` | Remove a routing rule |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `REGISTRY_URL` | `http://localhost:3500` | Urule registry service URL |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | `urule` | Temporal namespace |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

Apache-2.0
