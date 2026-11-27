# Password Recovery & Resend Email Delivery

This document describes the password recovery workflow, Resend integration,
security guarantees, database migrations, API contract, and troubleshooting.

---

## 1. Resend Account Setup

1. Create a Resend account at <https://resend.com/>.
2. In the Resend dashboard, create an API key under **API Keys** with permission
   to send emails.
3. Never commit your API key to `.env`, source files, or Git.

---

## 2. Sending Domain Configuration

### Local Development

For local development and initial integration testing before configuring custom
DNS records, Resend provides a testing sender address (`onboarding@resend.dev`)
that delivers only to your Resend account's verified email address:

```env
RESEND_API_KEY=re_your_development_api_key
EMAIL_FROM=Team-Platform <onboarding@resend.dev>
FRONTEND_URL=http://localhost:8080
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=60
```

### Production

For production, sending from a custom domain requires domain verification in
Resend:

1. Add your sending domain (for example, `mail.example.edu`) under **Domains**
   in the Resend dashboard.
2. Add the **SPF**, **DKIM**, and optional **DMARC** DNS records provided by
   Resend at your DNS provider.
3. Wait until Resend reports the domain status as **Verified**.
4. Set `EMAIL_FROM` to an address on that verified domain (for example,
   `Team-Platform <no-reply@mail.example.edu>`).

---

## 3. Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes | `""` | Resend API key. In Compose/Vault deployments, store this in Vault (`secret/ft-transcendence/backend`) rather than `.env`. |
| `EMAIL_FROM` | Yes | `""` | Sender header (`Name <email@domain>` or `email@domain`). |
| `FRONTEND_URL` | No | `FRONTEND_ORIGIN` (`http://localhost:8080`) | Base frontend URL used when constructing `/reset-password?token=...` links in emails. |
| `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` | No | `60` | Token lifetime in minutes (minimum enforced: `5`). |
| `PASSWORD_RESET_REQUEST_LIMIT` | No | `5 per hour` | Rate limit on forgot-password requests per IP. |
| `PASSWORD_RESET_CONFIRM_LIMIT` | No | `10 per hour` | Rate limit on password-reset confirmations per IP. |

---

## 4. Testing Email Delivery

### Automated Tests (Mocked Resend)

Automated backend and frontend tests mock `resend.Emails.send` and never require
a real `RESEND_API_KEY`:

```bash
cd be
SECRET_KEY=test-only-session-signing-key-not-for-deployment \
DATABASE_URL="sqlite:////tmp/ft_test.db" \
STORAGE_ROOT=/tmp/ft_uploads \
.venv/bin/python -m unittest tests/test_password_recovery.py -v
```

### Manual Delivery Test in Development

1. Configure `RESEND_API_KEY`, `EMAIL_FROM="Team-Platform <onboarding@resend.dev>"`,
   and `FRONTEND_URL=http://localhost:8080` in your local untracked `.env` (or
   Vault secret if using Compose).
2. Ensure an account exists in PostgreSQL whose email matches your Resend
   account email when using `onboarding@resend.dev`.
3. Open `/forgot-password` in the web app, submit the email, and check both the
   recipient inbox and **Resend -> Emails** delivery logs.

---

## 5. API Endpoints

All `POST` requests require a valid session CSRF token in `X-CSRF-Token`
(`GET /api/auth/csrf`).

### Request Password Reset

- `POST /api/auth/forgot-password` (alias: `POST /api/auth/password-reset/request`)

Request:

```json
{
  "email": "student@example.edu"
}
```

Responses:

- `200 OK` (returned identically whether or not the account exists, or if the
  account is Microsoft SSO-only without a local password):

  ```json
  {
    "message": "If an account with that email exists, a password reset link has been sent."
  }
  ```

- `400 Bad Request` (malformed or missing email address):

  ```json
  {
    "message": "A valid email address is required"
  }
  ```

- `429 Too Many Requests` (rate limit exceeded):

  ```json
  {
    "message": "Too many requests. Please wait and try again."
  }
  ```

- `503 Service Unavailable` (email service unconfigured or Resend delivery failed;
  internal provider error details are never exposed):

  ```json
  {
    "message": "Unable to send password reset email right now. Please try again later."
  }
  ```

### Validate Reset Token

- `POST /api/auth/reset-password/validate` (alias: `POST /api/auth/password-reset/validate`)

Request:

```json
{
  "token": "<raw-reset-token>"
}
```

Responses:

- `200 OK`: `{"valid": true, "message": "Reset token is valid"}`
- `400 Bad Request`: `{"valid": false, "message": "Invalid or expired reset token"}`

### Confirm Password Reset

- `POST /api/auth/reset-password` (alias: `POST /api/auth/password-reset/confirm`)

Request:

```json
{
  "token": "<raw-reset-token>",
  "new_password": "NewStrongPassword123!",
  "confirm_password": "NewStrongPassword123!"
}
```

Responses:

- `200 OK`:

  ```json
  {
    "message": "Password reset successfully",
    "csrf_token": "<rotated-csrf-token>"
  }
  ```

- `400 Bad Request`: invalid/expired/used token, mismatched confirmation, or
  password policy violation (8–1024 characters).

---

## 6. Security Behavior & Token Policy

- **Cryptographic token generation**: 32-byte URL-safe random tokens via
  `secrets.token_urlsafe(32)`.
- **Hashed storage only**: PostgreSQL (`password_reset_tokens.token_hash`)
  stores only the SHA-256 hex digest; raw tokens are never stored or logged.
- **Expiration**: Tokens expire after `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES`
  (default **60 minutes**).
- **Single-use & concurrency safety**: Token consumption executes an atomic
  conditional `UPDATE ... WHERE token_hash = :hash AND used_at IS NULL AND expires_at > :now`
  inside the database transaction alongside password update and `session_version`
  increment. If any step fails, the transaction rolls back cleanly.
- **Superseding prior tokens**: Requesting a new reset token invalidates any
  previous unused tokens for that user once email delivery succeeds.
- **Anti-enumeration**: Registered, nonexistent, and passwordless Microsoft SSO
  accounts receive the exact same HTTP `200` response body.
- **Session invalidation**: `users.session_version` is incremented on reset so
  existing cookie sessions across all devices fail verification on their next
  authenticated request, and the resetting browser's session is cleared if active.
- **Password hashing**: Preserves the application's `werkzeug.security.generate_password_hash`
  implementation and `app.utils.validation.validate_password` rules.

---

## 7. Database Migration & Rollback

Apply pending migrations from `be/`:

```bash
flask --app run.py db upgrade
flask --app run.py db check
```

The migration `d8f1a2b3c4e5_add_user_session_version_and_reset_token_index.py`
adds `users.session_version` (`INTEGER NOT NULL DEFAULT 1`) and
`idx_password_reset_expires_at` on `password_reset_tokens(expires_at)` while
preserving all existing user and token records.

To roll back only this revision:

```bash
flask --app run.py db downgrade -1
```

---

## 8. Troubleshooting Common Delivery Errors

| Symptom / Status | Likely Cause | Resolution |
| --- | --- | --- |
| `503` — `Password reset email service is currently unavailable` | `RESEND_API_KEY` or `EMAIL_FROM` is empty or missing from Vault/environment. | Configure both variables and restart Flask. |
| `503` — `Unable to send password reset email right now` and Resend 401/403 in server logs | Invalid `RESEND_API_KEY`, unverified sending domain, or using `onboarding@resend.dev` to send to an unverified recipient email. | Verify the API key in Resend, verify your sending domain DNS records, or test with your Resend account's email when using `onboarding@resend.dev`. |
| `429` — `Too many requests` | Client exceeded `PASSWORD_RESET_REQUEST_LIMIT` or `PASSWORD_RESET_CONFIRM_LIMIT`. | Wait for the rate-limit window to reset or configure `RATE_LIMIT_STORAGE_URI` with Redis in multi-worker production. |
| `400` — `Invalid or expired reset token` | Link expired (> 60 minutes), token was already used, or a newer reset request superseded it. | Request a fresh password reset link from `/forgot-password`. |
