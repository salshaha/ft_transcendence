"""Reusable transactional email templates."""

from html import escape


def _format_expiry(expires_minutes):
    minutes = max(1, int(expires_minutes))
    if minutes % 60 == 0:
        hours = minutes // 60
        return "1 hour" if hours == 1 else f"{hours} hours"
    return "1 minute" if minutes == 1 else f"{minutes} minutes"


def render_password_reset_email(*, reset_url, first_name=None, expires_minutes=60):
    """Build subject, HTML body, and plain-text body for a password-reset email."""
    safe_name = escape(first_name.strip()) if isinstance(first_name, str) and first_name.strip() else ""
    greeting = f"Hi {safe_name}," if safe_name else "Hello,"
    plain_greeting = (
        f"Hi {first_name.strip()},"
        if isinstance(first_name, str) and first_name.strip()
        else "Hello,"
    )
    safe_url = escape(reset_url, quote=True)
    expiry_text = _format_expiry(expires_minutes)
    subject = "Reset your Team-Platform password"

    html_body = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{escape(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#003c43;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5faf9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dcebe8;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background-color:#003c43;padding:24px 32px;">
                <span style="display:inline-block;vertical-align:middle;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background-color:#135d66;color:#ffffff;font-weight:700;font-size:15px;">N</span>
                <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.01em;">Team-Platform</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#135d66;">Account Recovery</p>
                <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:700;color:#003c43;">Reset your password</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#365c60;">{greeting}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#365c60;">
                  We received a request to reset the password for your Team-Platform account. Use the button below to choose a new password.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:#135d66;">
                      <a href="{safe_url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Reset password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#587376;">
                  This link will expire in <strong>{escape(expiry_text)}</strong> and can only be used once.
                </p>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#587376;">
                  If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
                <hr style="border:0;border-top:1px solid #dcebe8;margin:24px 0 16px;" />
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6d898b;">
                  If the button above does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:#135d66;">
                  <a href="{safe_url}" target="_blank" rel="noopener noreferrer" style="color:#135d66;text-decoration:underline;">{safe_url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f5faf9;padding:16px 32px;border-top:1px solid #dcebe8;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6d898b;">
                  Sent by Team-Platform University Project Management
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    text_body = (
        f"{plain_greeting}\n\n"
        "We received a request to reset the password for your Team-Platform account.\n"
        f"Open the link below to choose a new password:\n{reset_url}\n\n"
        f"This link will expire in {expiry_text} and can only be used once.\n\n"
        "If you did not request a password reset, you can safely ignore this email. "
        "Your password will remain unchanged.\n\n"
        "Team-Platform"
    )

    return subject, html_body, text_body
