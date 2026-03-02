// Email sending — supports two providers (checked in order):
//
// 1. Resend (recommended — easiest, 3,000 free emails/month):
//    Sign up at resend.com → API Keys → Create key
//    Set on DigitalOcean:
//      RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//      EMAIL_FROM     = Apna Shahkot <noreply@yourdomain.com>
//                       (use onboarding@resend.dev for testing before domain verified)
//
// 2. SMTP fallback (Amazon SES, Gmail, etc.):
//    EMAIL_HOST = email-smtp.us-east-1.amazonaws.com
//    EMAIL_PORT = 587
//    EMAIL_USER = <SES SMTP username>
//    EMAIL_PASS = <SES SMTP password>
//    EMAIL_FROM = verified@yourdomain.com

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const secure = port === 465;
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return _transporter;
}

/**
 * Send email via Resend API (primary) or SMTP (fallback)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 */
async function sendEmail(to, subject, html) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || '"Apna Shahkot" <onboarding@resend.dev>';

  // ── Provider 1: Resend REST API ──────────────────────────────────────────
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromEmail, to, subject, html }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Resend API error:', data);
        return { ok: false, error: data.message || data.name || JSON.stringify(data) };
      }
      console.log(`[Resend] Email sent to ${to}: ${subject} (id: ${data.id})`);
      return { ok: true, id: data.id };
    } catch (err) {
      console.error('[Resend] Fetch error:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // ── Provider 2: SMTP fallback ─────────────────────────────────────────────
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.error('No email provider configured. Set RESEND_API_KEY (recommended) or EMAIL_USER + EMAIL_PASS for SMTP.');
    return { ok: false, error: 'No email provider configured. Set RESEND_API_KEY or EMAIL_USER + EMAIL_PASS.' };
  }

  try {
    const transporter = getTransporter();
    const from = fromEmail || `"Apna Shahkot" <${user}>`;
    const envelopeFrom = user; // SMTP envelope must match verified sender
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      envelope: { from: envelopeFrom, to },
    });
    console.log(`[SMTP] Email sent to ${to}: ${subject} (messageId: ${info.messageId})`);
    return { ok: true };
  } catch (error) {
    console.error('[SMTP] Email send error:', error.message);
    _transporter = null;
    return { ok: false, error: error.message };
  }
}

/**
 * Send Rishta approval email
 */
async function sendRishtaApprovalEmail(email, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; text-align: center;">Apna Shahkot</h1>
        <p style="color: #e8e8e8; text-align: center; margin-top: 10px;">Rishta Service</p>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333;">Congratulations, ${name}! 🎉</h2>
        <p style="color: #555; line-height: 1.6;">
          Your Rishta profile has been <strong style="color: #27ae60;">APPROVED</strong> by our admin team.
        </p>
        <p style="color: #555; line-height: 1.6;">
          You can now browse and connect with other verified profiles on the Apna Shahkot Rishta section.
        </p>
        <div style="background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
          <p style="color: #555; margin: 0;"><strong>Remember:</strong> All profiles are verified. Any misuse or illegal activity will result in strict action.</p>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This is an automated email from Apna Shahkot. Do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, '✅ Your Rishta Profile is Approved - Apna Shahkot', html).then(r => r.ok);
}

/**
 * Send Rishta rejection email
 */
async function sendRishtaRejectionEmail(email, name, reason) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; text-align: center;">Apna Shahkot</h1>
        <p style="color: #e8e8e8; text-align: center; margin-top: 10px;">Rishta Service</p>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333;">Hello, ${name}</h2>
        <p style="color: #555; line-height: 1.6;">
          Unfortunately, your Rishta profile has been <strong style="color: #e74c3c;">not approved</strong> at this time.
        </p>
        ${reason ? `<p style="color: #555; line-height: 1.6;"><strong>Reason:</strong> ${reason}</p>` : ''}
        <p style="color: #555; line-height: 1.6;">
          Please review and resubmit your profile with correct information.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This is an automated email from Shahkot App. Do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, '❌ Rishta Profile Update - Apna Shahkot', html).then(r => r.ok);
}

module.exports = {
  sendEmail,
  sendRishtaApprovalEmail,
  sendRishtaRejectionEmail,
};
