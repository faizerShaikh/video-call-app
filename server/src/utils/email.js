import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../assets/logo-email.png');

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials are not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: {
      user,
      pass,
    },
    tls: {
      ciphers: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  });
};

const resolveFromAddress = () => {
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  if (!from) {
    throw new Error('SMTP_FROM or SMTP_USER is not configured');
  }
  // Allow either "email@domain.com" or '"Name" <email@domain.com>'
  if (from.includes('<') && from.includes('>')) {
    return from;
  }
  return `"Synchro" <${from}>`;
};

const buildPasswordResetHtml = ({ displayName, otp }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Synchro password reset</title>
</head>
<body style="margin:0;padding:0;background-color:#eef4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7e4e6;box-shadow:0 8px 24px rgba(15, 76, 73, 0.08);">
          <tr>
            <td align="center" style="padding:28px 32px 16px;background:linear-gradient(180deg,#f7fbfb 0%,#ffffff 100%);border-bottom:1px solid #e6f0f1;">
              <img src="cid:synchro-logo" alt="Synchro" width="140" style="display:block;width:140px;max-width:60%;height:auto;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#2e9a94;font-weight:700;">Password reset</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#123338;">Hi ${displayName},</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4a6064;">
                Use the one-time code below to reset your Synchro password. For your security, do not share this code with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3faf9;border:1px solid #cfe8e6;border-radius:12px;">
                <tr>
                  <td align="center" style="padding:24px 16px;">
                    <p style="margin:0 0 10px;font-size:13px;color:#5f787c;letter-spacing:0.04em;text-transform:uppercase;font-weight:600;">Verification code</p>
                    <p style="margin:0;font-size:34px;line-height:1.2;letter-spacing:10px;font-weight:700;color:#0f4c49;font-family:'Courier New',Courier,monospace;">
                      ${otp}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff8e8;border:1px solid #f0e0b0;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;line-height:1.5;color:#7a6420;">
                    This code expires in <strong>10 minutes</strong> and can only be used once.
                    If you did not request a password reset, you can safely ignore this email.
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#7a9094;">
                — The Synchro Team
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 32px 24px;background-color:#f7fbfb;border-top:1px solid #e6f0f1;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8aa0a4;">
                © ${new Date().getFullYear()} Synchro. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const sendOtpEmail = async ({ to, otp, name }) => {
  const transporter = createTransporter();
  const from = resolveFromAddress();
  const displayName = name ? name.split(' ')[0] : 'there';

  const info = await transporter.sendMail({
    from,
    to,
    bcc: process.env.SMTP_BCC,
    subject: 'Your Synchro password reset code',
    text: `Hi ${displayName},\n\nYour password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request a password reset, you can ignore this email.\n\n— Synchro`,
    html: buildPasswordResetHtml({ displayName, otp }),
    attachments: [
      {
        filename: 'logo.png',
        path: LOGO_PATH,
        cid: 'synchro-logo',
        contentDisposition: 'inline',
      },
    ],
  });

  return info;
};
