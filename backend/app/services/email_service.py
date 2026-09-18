"""Email service using real SMTP to send verification emails."""
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

async def send_verification_email(email: str, token: str):
    """Send a real verification email via SMTP."""
    verification_url = f"{FRONTEND_URL}/verify?token={token}"
    
    if not SMTP_USERNAME or not SMTP_PASSWORD or SMTP_PASSWORD == "REPLACE_ME_WITH_APP_PASSWORD":
        logger.warning("SMTP credentials not configured. Falling back to mock email.")
        print(f"--- MOCK EMAIL TO {email} ---\nLink: {verification_url}\n---------------------------")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your account - Unified Intelligence Platform"
    msg["From"] = f"UIP Platform <{SMTP_FROM_EMAIL}>"
    msg["To"] = email

    text = f"""
Welcome to the platform!

To complete your registration, please click the following link to verify your email address:
{verification_url}

If you did not request this, please ignore this email.
"""

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1;">Welcome to the Unified Intelligence Platform!</h2>
        <p>To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{verification_url}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{verification_url}" style="color: #6366f1;">{verification_url}</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
        <p style="color: #999; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
      </body>
    </html>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    class IPv4SMTP(smtplib.SMTP):
        def _get_socket(self, host, port, timeout):
            import socket
            ipv4 = socket.gethostbyname(host)
            return socket.create_connection((ipv4, port), timeout, self.source_address)

    try:
        server = IPv4SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM_EMAIL, email, msg.as_string())
        server.quit()
        logger.info(f"Verification email successfully sent to {email}")
        # Always print to console for easy local testing
        print(f"--- EMAIL SENT TO {email} ---\nLink: {verification_url}\n---------------------------", flush=True)
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")
        # Fallback to console if SMTP fails
        print(f"--- MOCK EMAIL TO {email} (SMTP FAILED) ---\nLink: {verification_url}\n---------------------------", flush=True)

async def send_password_reset_email(email: str, token: str):
    """Send a password reset email via SMTP."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    
    if not SMTP_USERNAME or not SMTP_PASSWORD or SMTP_PASSWORD == "REPLACE_ME_WITH_APP_PASSWORD":
        logger.warning("SMTP credentials not configured. Falling back to mock email.")
        print(f"--- MOCK RESET PASSWORD EMAIL TO {email} ---\nLink: {reset_url}\n---------------------------", flush=True)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your password - Unified Intelligence Platform"
    msg["From"] = f"UIP Platform <{SMTP_FROM_EMAIL}>"
    msg["To"] = email

    text = f"""
We received a request to reset your password.

Click the link below to choose a new password:
{reset_url}

If you did not request this, please ignore this email.
"""

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1;">Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{reset_url}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{reset_url}" style="color: #6366f1;">{reset_url}</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
        <p style="color: #999; font-size: 12px;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
      </body>
    </html>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    class IPv4SMTP(smtplib.SMTP):
        def _get_socket(self, host, port, timeout):
            import socket
            ipv4 = socket.gethostbyname(host)
            return socket.create_connection((ipv4, port), timeout, self.source_address)

    try:
        server = IPv4SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM_EMAIL, email, msg.as_string())
        server.quit()
        logger.info(f"Password reset email successfully sent to {email}")
        # Always print to console for easy local testing
        print(f"--- RESET PASSWORD EMAIL SENT TO {email} ---\nLink: {reset_url}\n---------------------------", flush=True)
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        # Fallback to console if SMTP fails
        print(f"--- MOCK RESET PASSWORD EMAIL TO {email} (SMTP FAILED) ---\nLink: {reset_url}\n---------------------------", flush=True)

