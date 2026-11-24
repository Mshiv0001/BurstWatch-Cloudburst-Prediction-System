"""Email delivery service supporting multi-provider SMTP and zero-config dev console mode.

When SMTP_HOST is not configured or EMAIL_DEV_MODE is True, the service logs verification
codes and alert notifications to the terminal with high-visibility ASCII formatting,
allowing instant local development without requiring external mail server credentials.
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from .config import Settings

logger = logging.getLogger("cloudburst.email")


class EmailService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.is_dev_mode = bool(settings.email_dev_mode or not settings.smtp_host)

    def _render_verification_html(self, code: str, expires_minutes: int) -> str:
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BurstWatch Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" style="max-width: 560px; background: rgba(14, 20, 36, 0.95); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; padding: 8px 18px; border-radius: 9999px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35);">
                <span style="font-size: 13px; font-weight: 700; color: #38bdf8; letter-spacing: 0.1em; text-transform: uppercase;">BurstWatch Radar &amp; Early Warning</span>
              </div>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Verify Your Email Address</h1>
            </td>
          </tr>
          <!-- Body Text -->
          <tr>
            <td style="padding-bottom: 28px; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
              Thank you for subscribing to BurstWatch convective cloudburst and extreme weather early warnings. Use the 6-digit verification code below to confirm your subscription:
            </td>
          </tr>
          <!-- OTP Box -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <div style="display: inline-block; background: rgba(6, 182, 212, 0.1); border: 2px solid #06b6d4; border-radius: 16px; padding: 18px 36px; box-shadow: 0 0 24px rgba(6, 182, 212, 0.2);">
                <span style="font-family: ui-monospace, 'Courier New', monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #38bdf8; margin-right: -12px;">{code}</span>
              </div>
            </td>
          </tr>
          <!-- Expiration Notice -->
          <tr>
            <td style="padding-bottom: 28px; font-size: 12px; color: #64748b; text-align: center;">
              This code will expire in <strong style="color: #cbd5e1;">{expires_minutes} minutes</strong>. If you did not request this verification, please safely ignore this email.
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px;">
              <p style="margin: 0; font-size: 11px; color: #475569; text-align: center;">
                Pan-India Physics-Informed Convective Cloudburst &amp; Flash Flood Warning System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def _render_alert_html(self, alert_data: Dict[str, Any], unsubscribe_token: str) -> str:
        loc = alert_data.get("location", "Monitored Region")
        prob = float(alert_data.get("predicted_probability", 0.0))
        target_date = alert_data.get("target_date", "Upcoming Day")
        thresh = float(alert_data.get("threshold", 0.50))
        severity = "EXTREME CONVECTIVE ALERT" if prob >= 0.70 else "ELEVATED RAINFALL WARNING"
        header_color = "#f43f5e" if prob >= 0.70 else "#f59e0b"

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BurstWatch Weather Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width: 580px; background: rgba(18, 12, 16, 0.95); border: 1px solid {header_color}55; border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);">
          <!-- Header Badge -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <div style="display: inline-block; padding: 6px 16px; border-radius: 9999px; background: {header_color}22; border: 1px solid {header_color}88;">
                <span style="font-size: 12px; font-weight: 800; color: {header_color}; letter-spacing: 0.12em; text-transform: uppercase;">⚠️ {severity}</span>
              </div>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">Convective Risk for {loc}</h1>
            </td>
          </tr>
          <!-- Main Details Table -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table width="100%" style="background: rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.08);">
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; padding: 6px 0;">Target Date:</td>
                  <td align="right" style="font-size: 14px; font-weight: 700; color: #f8fafc; padding: 6px 0;">{target_date}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; padding: 6px 0;">Convective Risk Probability:</td>
                  <td align="right" style="font-size: 16px; font-weight: 800; color: {header_color}; padding: 6px 0;">{prob*100:.1f}%</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; padding: 6px 0;">Warning Threshold:</td>
                  <td align="right" style="font-size: 14px; font-weight: 600; color: #cbd5e1; padding: 6px 0;">{thresh*100:.1f}%</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Precaution Advice -->
          <tr>
            <td style="padding-bottom: 28px; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
              <strong>Precautionary Advisory:</strong> High moisture convergence and instability indices indicate elevated probability of rapid convective cell formation and heavy downpours (&gt;50 mm/day). Please avoid low-lying drainage channels and steep mountain streams.
            </td>
          </tr>
          <!-- Footer & Unsubscribe -->
          <tr>
            <td style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; font-size: 11px; color: #64748b; text-align: center;">
              You received this alert because you are a verified subscriber.
              <br><br>
              <a href="http://localhost:8000/subscribers/unsubscribe?token={unsubscribe_token}" style="color: #94a3b8; text-decoration: underline;">One-Click Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def _dispatch_smtp(self, to_email: str, subject: str, text_content: str, html_content: str) -> tuple[bool, str]:
        """Send via real SMTP server with TLS/SSL."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.settings.smtp_from
        msg["To"] = to_email

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
            err = f"SMTP Authentication failed: check username and password (for Gmail, use a 16-character App Password). Details: {exc}"
            logger.error(err)
            return False, err
        except Exception as exc:
            err = f"SMTP Delivery error ({self.settings.smtp_host}:{self.settings.smtp_port}): {exc}"
            logger.error(err)
            return False, err

    def send_verification_email(self, to_email: str, code: str, expires_minutes: int = 15) -> Dict[str, Any]:
        """Dispatch a 6-digit verification code to the recipient."""
        subject = f"BurstWatch Verification Code: {code}"
        text_content = (
            f"Your BurstWatch email verification code is: {code}\n\n"
            f"This code will expire in {expires_minutes} minutes.\n"
            "If you did not request this, please ignore this email."
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
        """Dispatch a severe convective rainfall warning to a subscriber."""
        loc = alert_data.get("location", "Monitored Region")
        prob = float(alert_data.get("predicted_probability", 0.0))
        subject = f"⚠️ [BurstWatch Alert] Convective Rainfall Risk ({prob*100:.0f}%) - {loc}"
        text_content = (
            f"BurstWatch Weather Alert for {loc}\n"
            f"Target Date: {alert_data.get('target_date', 'Next Day')}\n"
            f"Predicted Risk: {prob*100:.1f}%\n"
            f"Threshold: {float(alert_data.get('threshold', 0.5))*100:.1f}%\n\n"
            "Precautionary Advisory: Rapid convective development anticipated. Avoid low-lying riverbeds.\n\n"
            f"Unsubscribe: http://localhost:8000/subscribers/unsubscribe?token={unsubscribe_token}\n"
        )
        html_content = self._render_alert_html(alert_data, unsubscribe_token)

        if self.is_dev_mode:
            banner = (
                "\n" + "!" * 72 + "\n"
                f" [BURSTWATCH WEATHER ALERT EMAIL]\n"
                f" TO: {to_email}\n"
                f" SUBJECT: {subject}\n"
                f" LOCATION: {loc} | PROBABILITY: {prob*100:.1f}%\n"
                + "!" * 72 + "\n"
            )
            print(banner)
            return {"success": True, "dev_mode": True, "recipient": to_email}
        else:
            ok = self._dispatch_smtp(to_email, subject, text_content, html_content)
            return {"success": ok, "dev_mode": False, "recipient": to_email}

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

