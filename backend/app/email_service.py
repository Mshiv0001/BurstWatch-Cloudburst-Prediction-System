"""Email delivery service supporting multi-provider SMTP and zero-config dev console mode.

When SMTP_HOST is not configured or EMAIL_DEV_MODE is True, the service logs verification
codes and alert notifications to the terminal with high-visibility ASCII formatting,
allowing instant local development without requiring external mail server credentials.
"""
from __future__ import annotations

import html
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid, parseaddr
from typing import Any, Dict, List, Optional

from .config import Settings

logger = logging.getLogger("cloudburst.email")


class EmailService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.is_dev_mode = bool(settings.email_dev_mode or not settings.smtp_host)

    def _get_unsubscribe_url(self, unsubscribe_token: str) -> str:
        """Return a public HTTPS/HTTP unsubscribe URL only when PUBLIC_BASE_URL is a non-localhost origin."""
        base = (self.settings.public_base_url or "").strip().rstrip("/")
        if not base or not (base.startswith("https://") or base.startswith("http://")):
            return ""
        lowered = base.lower()
        if "localhost" in lowered or "127.0.0.1" in lowered:
            return ""
        return f"{base}/subscribers/unsubscribe?token={unsubscribe_token}"

    def _render_verification_html(self, code: str, expires_minutes: int) -> str:
        safe_code = html.escape(str(code))
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BurstWatch Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px 24px;">
          <tr>
            <td style="padding-bottom: 12px; font-size: 13px; font-weight: 700; color: #0284c7;">
              BurstWatch Weather Alerts
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">Confirm your email address</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 20px; font-size: 14px; line-height: 1.6; color: #334155;">
              Enter this 6-digit verification code in BurstWatch to complete your alert setup:
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 20px;">
              <div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 24px;">
                <span style="font-family: ui-monospace, 'Courier New', monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0f172a;">{safe_code}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px; font-size: 13px; line-height: 1.5; color: #475569;">
              This code expires in {expires_minutes} minutes. If you did not request it, you can ignore this message.
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #64748b;">
              BurstWatch Convective Monitoring
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def _render_alert_html(self, alert_data: Dict[str, Any], unsubscribe_token: str) -> str:
        loc = html.escape(str(alert_data.get("location", "Monitored Region")))
        prob = float(alert_data.get("predicted_probability", 0.0))
        target_date = html.escape(str(alert_data.get("target_date", "Upcoming Day")))
        thresh = float(alert_data.get("threshold", 0.50))
        severity = html.escape("High Convective Risk" if prob >= 0.70 else "Elevated Rainfall Advisory")
        accent = "#dc2626" if prob >= 0.70 else "#d97706"
        unsub_url = self._get_unsubscribe_url(unsubscribe_token)
        safe_unsub_url = html.escape(unsub_url, quote=True)
        unsub_footer = (
            f'<a href="{safe_unsub_url}" style="color: #475569; text-decoration: underline;">Unsubscribe from alerts</a>'
            if unsub_url
            else "You can update or pause alerts anytime in the BurstWatch Alerts panel."
        )

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BurstWatch Weather Advisory</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px 24px;">
          <tr>
            <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: {accent};">
              {severity}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">Weather Advisory for {loc}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 18px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 13px; color: #475569; padding: 4px 0;">Target Date</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: #0f172a; padding: 4px 0;">{target_date}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #475569; padding: 4px 0;">Convective Risk Probability</td>
                  <td align="right" style="font-size: 14px; font-weight: 700; color: {accent}; padding: 4px 0;">{prob*100:.1f}%</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #475569; padding: 4px 0;">Alert Threshold</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: #334155; padding: 4px 0;">{thresh*100:.1f}%</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 20px; font-size: 14px; line-height: 1.6; color: #334155;">
              Forecast models indicate elevated convective moisture convergence and potential heavy rainfall. Monitor local conditions and avoid low-lying drainage channels or steep mountain streams.
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #64748b;">
              Sent for your configured BurstWatch region. {unsub_footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def _dispatch_smtp(self, to_email: str, subject: str, text_content: str, html_content: str,
                       headers: Optional[Dict[str, str]] = None) -> tuple[bool, str]:
        """Send via real SMTP server with TLS/SSL and full RFC 5322 headers."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.settings.smtp_from
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)

        _, from_addr = parseaddr(self.settings.smtp_from)
        sender_domain = from_addr.split("@", 1)[1] if "@" in from_addr else "burstwatch.local"
        msg["Message-ID"] = make_msgid(domain=sender_domain)
        if from_addr:
            msg["Reply-To"] = from_addr

        if headers:
            for k, v in headers.items():
                msg[k] = v

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            if self.settings.smtp_ssl:
                with smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port, timeout=12) as server:
                    if self.settings.smtp_user and self.settings.smtp_password:
                        server.login(self.settings.smtp_user, self.settings.smtp_password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=12) as server:
                    if self.settings.smtp_tls:
                        server.starttls()
                    if self.settings.smtp_user and self.settings.smtp_password:
                        server.login(self.settings.smtp_user, self.settings.smtp_password)
                    server.send_message(msg)
            logger.info("Email successfully dispatched via SMTP to %s", to_email)
            return True, "Email sent successfully"
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("SMTP Authentication failed (%s:%s): %s", self.settings.smtp_host, self.settings.smtp_port, exc)
            return False, "SMTP authentication failed."
        except Exception as exc:
            logger.error("SMTP Delivery error (%s:%s): %s", self.settings.smtp_host, self.settings.smtp_port, exc)
            return False, "SMTP delivery failed."

    def send_verification_email(self, to_email: str, code: str, expires_minutes: int = 15) -> Dict[str, Any]:
        """Dispatch a 6-digit verification code to the recipient."""
        subject = f"BurstWatch Verification Code: {code}"
        text_content = (
            f"Your BurstWatch verification code is: {code}\n\n"
            f"Enter this code to confirm your email address. It expires in {expires_minutes} minutes.\n"
            "If you did not request this, you can ignore this message."
        )
        html_content = self._render_verification_html(code, expires_minutes)

        if self.is_dev_mode:
            banner = (
                "\n" + "=" * 72 + "\n"
                f" [BURSTWATCH DEV EMAIL CONSOLE]\n"
                f" TO: {to_email}\n"
                f" SUBJECT: {subject}\n"
                f" VERIFICATION CODE: >>> {code} <<<\n"
                f" EXPIRES IN: {expires_minutes} minutes\n"
                + "=" * 72 + "\n"
            )
            print(banner)
            logger.info("DEV_MODE: Simulated verification email sent to %s with OTP: %s", to_email, code)
            return {
                "success": True,
                "dev_mode": True,
                "recipient": to_email,
                "code": code,
                "message": "Verification code logged to server console (dev mode)",
            }
        else:
            ok, err_msg = self._dispatch_smtp(to_email, subject, text_content, html_content)
            return {
                "success": ok,
                "dev_mode": False,
                "recipient": to_email,
                "message": "Verification email dispatched" if ok else err_msg,
                "error": err_msg if not ok else None,
            }

    def send_alert_email(self, to_email: str, alert_data: Dict[str, Any], unsubscribe_token: str) -> Dict[str, Any]:
        """Dispatch a severe convective rainfall advisory to a verified subscriber."""
        loc = alert_data.get("location", "Monitored Region")
        prob = float(alert_data.get("predicted_probability", 0.0))
        subject = f"BurstWatch Weather Advisory: {loc} ({prob*100:.0f}% convective risk)"
        unsub_url = self._get_unsubscribe_url(unsubscribe_token)
        unsub_line = f"Unsubscribe: {unsub_url}\n" if unsub_url else "Manage alerts anytime in the BurstWatch Alerts panel.\n"
        text_content = (
            f"BurstWatch Weather Advisory for {loc}\n"
            f"Target Date: {alert_data.get('target_date', 'Next Day')}\n"
            f"Convective Risk Probability: {prob*100:.1f}%\n"
            f"Alert Threshold: {float(alert_data.get('threshold', 0.5))*100:.1f}%\n\n"
            "Advisory: Rapid convective development is possible. Avoid low-lying riverbeds and steep drainage channels.\n\n"
            + unsub_line
        )
        html_content = self._render_alert_html(alert_data, unsubscribe_token)
        rfc8058_headers = (
            {
                "List-Unsubscribe": f"<{unsub_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
            if unsub_url
            else None
        )

        if self.is_dev_mode:
            banner = (
                "\n" + "!" * 72 + "\n"
                f" [BURSTWATCH WEATHER ALERT EMAIL]\n"
                f" TO: {to_email}\n"
                f" SUBJECT: {subject}\n"
                f" LOCATION: {loc} | PROBABILITY: {prob*100:.1f}%\n"
                + (f" LIST-UNSUBSCRIBE: <{unsub_url}>\n" if unsub_url else "")
                + "!" * 72 + "\n"
            )
            print(banner)
            return {"success": True, "dev_mode": True, "recipient": to_email}
        else:
            ok, err_msg = self._dispatch_smtp(to_email, subject, text_content, html_content, headers=rfc8058_headers)
            return {"success": ok, "dev_mode": False, "recipient": to_email, "error": err_msg if not ok else None}

    def broadcast_weather_alert(self, subscribers: List[Dict[str, Any]], alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Broadcast alert to all verified subscribers."""
        sent = 0
        failed = 0
        for sub in subscribers:
            res = self.send_alert_email(sub["email"], alert_data, sub.get("unsubscribe_token", ""))
            if res.get("success"):
                sent += 1
            else:
                failed += 1
        return {"sent": sent, "failed": failed, "total": len(subscribers)}
