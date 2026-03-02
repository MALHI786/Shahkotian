// Email sending  tries providers in this order:
//  1. Resend REST API   (set RESEND_API_KEY; EMAIL_FROM must be a Resend-verified domain)
//  2. AWS SES SDK       (set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
//  3. SES SMTP fallback (set EMAIL_USER + EMAIL_PASS)

const nodemailer = require('nodemailer');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

let _sesClient = null;
let _smtpTransporter = null;

function getSESClient() {
  if (_sesClient) return _sesClient;
  _sesClient = new SESClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return _sesClient;
}

function getSMTPTransporter() {
  if (_smtpTransporter) return _smtpTransporter;
  _smtpTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'email-smtp.us-east-1.amazonaws.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: parseInt(process.env.EMAIL_PORT || '587', 10) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return _smtpTransporter;
}

/**
 * Send an email. Returns { ok, provider, id?, error? }
 */
async function sendEmail(to, subject, html) {
  const fromEmail = process.env.EMAIL_FROM || 'mypcjnaab@gmail.com';

  // 1. Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: `Apna Shahkot <${fromEmail}>`, to, subject, html }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[Resend] Sent to ${to} | id: ${data.id}`);
        return { ok: true, provider: 'Resend', id: data.id };
      }
      console.warn(`[Resend] Failed (${res.status}): ${data.message || JSON.stringify(data)}  falling through`);
    } catch (err) {
      console.warn(`[Resend] Fetch error: ${err.message}  falling through`);
    }
  }

  // 2. AWS SES SDK
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const result = await getSESClient().send(new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      }));
      console.log(`[SES SDK] Sent to ${to} | msgId: ${result.MessageId}`);
      return { ok: true, provider: 'AWS SES SDK', id: result.MessageId };
    } catch (err) {
      console.warn(`[SES SDK] Error: ${err.message}  falling through`);
      _sesClient = null;
    }
  }

  // 3. SES SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const info = await getSMTPTransporter().sendMail({
        from: `"Apna Shahkot" <${fromEmail}>`,
        envelope: { from: fromEmail, to },
        to, subject, html,
      });
      console.log(`[SMTP] Sent to ${to} | msgId: ${info.messageId}`);
      return { ok: true, provider: 'SES SMTP' };
    } catch (err) {
      console.error(`[SMTP] Error: ${err.message}`);
      _smtpTransporter = null;
      return { ok: false, provider: 'SES SMTP', error: err.message };
    }
  }

  return { ok: false, provider: 'None', error: 'No email provider configured.' };
}

async function sendRishtaApprovalEmail(email, name) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;border-radius:10px 10px 0 0;"><h1 style="color:#fff;margin:0;text-align:center;">Apna Shahkot</h1></div><div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;"><h2>Congratulations, ${name}! Your Rishta profile has been APPROVED.</h2></div></div>`;
  const result = await sendEmail(email, 'Your Rishta Profile is Approved - Apna Shahkot', html);
  return result.ok;
}

async function sendRishtaRejectionEmail(email, name, reason) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;border-radius:10px 10px 0 0;"><h1 style="color:#fff;margin:0;text-align:center;">Apna Shahkot</h1></div><div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;"><h2>Hello ${name}, your profile was not approved.</h2>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}</div></div>`;
  const result = await sendEmail(email, 'Rishta Profile Update - Apna Shahkot', html);
  return result.ok;
}

module.exports = { sendEmail, sendRishtaApprovalEmail, sendRishtaRejectionEmail };
