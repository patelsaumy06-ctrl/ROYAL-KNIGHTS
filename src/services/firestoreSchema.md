## Firestore Schema

All tenant data is scoped per NGO:

- `ngos/{ngoEmail}/incidents/{incidentId}`
- `ngos/{ngoEmail}/resources/{resourceId}`

### `incidents` document

- `title`: string
- `description`: string
- `location`: string
- `severity`: `"low" | "medium" | "urgent"`
- `timestamp`: Firestore timestamp
- `status`: `"open" | "active" | "resolved"`

Compatibility fields used by existing UI are also stored:

- `category`, `priority`, `volunteers`, `assigned`, `region`, `deadline`, `lat`, `lng`, `reportText`, `urgencyScore`

### `resources` document

- `type`: string
- `availability`: boolean
- `location`: string
- `createdAt`: Firestore timestamp
- `updatedAt`: Firestore timestamp
