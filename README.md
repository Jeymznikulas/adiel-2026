# Adiel System

A production-oriented starting point for a React/TypeScript frontend, a layered .NET REST API, and Supabase.

## Structure

```text
.
|-- src/
|   |-- web/                         React, TypeScript, Vite, Tailwind CSS
|   `-- api/
|       |-- AdielSystem.Api/         HTTP endpoints and composition root
|       |-- AdielSystem.Application/ use cases and application contracts
|       |-- AdielSystem.Domain/      business rules and domain models
|       `-- AdielSystem.Infrastructure/ external services and persistence
|-- tests/
|   |-- AdielSystem.UnitTests/
|   `-- AdielSystem.IntegrationTests/
|-- supabase/
|   |-- migrations/                  versioned PostgreSQL schema
|   `-- seed.sql                     local development data
`-- docs/                            architecture decisions
```

## Dependency policy

No dependencies are installed by this scaffold. For a professional React/TypeScript build, React, Tailwind, and Vite are declared as versioned npm dependencies rather than loaded from a CDN. This provides reproducible builds, type checking, tree shaking, and a strict Content Security Policy. CDN delivery is appropriate for deployed static assets, fonts, and images; it is not used for build-time tooling.

## First run

Copy the example environment files and fill in your Supabase project values:

```powershell
Copy-Item src/web/.env.example src/web/.env.local
Copy-Item src/api/AdielSystem.Api/appsettings.Development.example.json src/api/AdielSystem.Api/appsettings.Development.json
```

When you are ready to download dependencies:

```powershell
npm install --prefix src/web
npm run dev --prefix src/web
dotnet restore AdielSystem.slnx
dotnet run --project src/api/AdielSystem.Api
```

The frontend defaults to `http://localhost:5173`; the API launch profile uses `http://localhost:5080`. Health is available at `/health` and versioned endpoints start at `/api/v1`.

## Configuration rules

- Only variables prefixed with `VITE_` are exposed to the browser.
- Use the Supabase anonymous key in the frontend only when direct Supabase features are intentionally enabled and protected by Row Level Security.
- Never expose a Supabase service-role key to the frontend.
- API secrets belong in environment variables, .NET user secrets, or the deployment platform's secret manager.

See [docs/authentication.md](docs/authentication.md) for the username-based Supabase Auth setup and first-user provisioning.

For local backend development, store the Supabase database connection string with .NET user secrets rather than committing its password:

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=aws-0-ap-northeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.yrscqzdqfyneaguoncwl;Password=YOUR-DATABASE-PASSWORD;SSL Mode=Require;Trust Server Certificate=true" --project src/api/AdielSystem.Api
```
