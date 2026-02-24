const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: true, // Use SSL (port 465) — required on most cloud hosts like Render
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certs on cloud
  },
});

/**
 * Send email notification
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 */
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Apna Shahkot" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    return { ok: true };
  } catch (error) {
    console.error('Email send error:', error.message, '| code:', error.code, '| response:', error.response);
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
