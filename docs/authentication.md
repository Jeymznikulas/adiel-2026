# Username authentication

Supabase Auth verifies passwords and owns sessions. Because Supabase password authentication accepts email or phone rather than a native username, the web app converts a normalized username into an internal, non-deliverable email:

```text
username -> username@users.adiel.local
```

The domain is configured by `VITE_SUPABASE_USERNAME_DOMAIN` and must never change after accounts are provisioned.

## Configure the project

1. Copy `src/web/.env.example` to `src/web/.env.local`.
2. Set `VITE_SUPABASE_URL` to the project URL.
3. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key. A legacy anonymous key also works, but the new publishable key is preferred.
4. Apply the SQL migrations in timestamp order through the Supabase dashboard or CLI.

Do not put a secret key or legacy service-role key in any `VITE_` variable.

## Create the first user

In Supabase Dashboard, open **Authentication > Users > Add user** and create:

```text
Email: admin@users.adiel.local
Password: choose a strong unique password
Auto confirm user: enabled
```

The person signs in to the application with username `admin`, not the synthetic email. The database trigger creates the matching profile row.

## Operational consequences

- Password reset is administrator-managed because the synthetic email cannot receive mail.
- Usernames allow letters, digits, period, underscore, and hyphen; they are normalized to lowercase.
- Authentication errors deliberately do not reveal whether a username exists.
- The browser receives only the publishable key. Secret or service-role keys remain server-side.

