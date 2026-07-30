# Architecture

## Direction of dependencies

```text
Api -> Application <- Infrastructure
             |
             v
           Domain
```

- **Domain** contains business rules and has no framework dependencies.
- **Application** coordinates use cases and defines interfaces required from infrastructure.
- **Infrastructure** implements persistence and external-service interfaces.
- **Api** owns HTTP concerns and wires the layers together.
- **Web** communicates with the API through a small typed client boundary.

## Supabase boundary

Supabase owns PostgreSQL, migrations, authentication, storage, and optional realtime features. Business workflows should pass through the API. A browser may call Supabase directly only for a deliberate capability such as authentication or realtime, protected by Row Level Security.

Schema changes are forward-only SQL files under `supabase/migrations`. Production changes should be reviewed and applied by CI rather than from a developer workstation.

