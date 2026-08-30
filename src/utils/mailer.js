const brevo = require("@getbrevo/brevo");
const nodemailer = require("nodemailer");

/**
 * Creates and returns a Nodemailer transporter based on available environment variables.
 * Fallbacks gracefully if SMTP configuration is not provided.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.EMAIL_USER || process.env.SMTP_USER || process.env.BREVO_SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.BREVO_SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Dispatches an email using the Brevo API (primary) or Nodemailer / Mock fallback
 */
async function dispatchEmail({ toEmail, toName, senderEmail, senderName, replyToEmail, replyToName, subject, htmlContent }) {
  const brevoApiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;

  // 1. Primary Method: Brevo REST API via BrevoClient
  if (brevoApiKey) {
    try {
      const client = new brevo.BrevoClient({ apiKey: brevoApiKey.trim() });

      const emailPayload = {
        subject,
        htmlContent,
        sender: {
          name: senderName || "HostelCare Portal",
          email: senderEmail || process.env.BREVO_SENDER_EMAIL || "omverma.dev@gmail.com",
        },
        to: [{ email: toEmail, name: toName || toEmail }],
      };

      if (replyToEmail) {
        emailPayload.replyTo = {
          email: replyToEmail,
          name: replyToName || replyToEmail,
        };
      }

      const result = await client.transactionalEmails.sendTransacEmail(emailPayload);
      console.log(`[Brevo API Success] Email dispatched to ${toEmail} (MessageId: ${result?.messageId || "sent"})`);
      return { success: true, provider: "brevo", data: result };
    } catch (brevoErr) {
      console.error("[Brevo API Error]:", brevoErr.message || brevoErr);
      // Fall through to SMTP fallback
    }
  }

  // 2. Secondary Method: Nodemailer SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${senderName || "HostelCare Team"}" <${senderEmail || process.env.EMAIL_USER || "no-reply@hostelcare.internal"}>`,
        to: toEmail,
        replyTo: replyToEmail ? `"${replyToName || replyToEmail}" <${replyToEmail}>` : undefined,
        subject,
        html: htmlContent,
      });
      console.log(`[SMTP Success] Email sent to ${toEmail} (${info.messageId})`);
      return { success: true, provider: "smtp", info };
    } catch (smtpErr) {
      console.error("[SMTP Error]:", smtpErr.message);
    }
  }

  // 3. Fallback: Structured Mock Preview
  console.log(`\n================= [EMAIL MOCK / NO ACTIVE API KEY] =================`);
  console.log(`[TO]: ${toName ? `${toName} <${toEmail}>` : toEmail}`);
  console.log(`[FROM]: ${senderName || "HostelCare"} <${senderEmail || "no-reply@hostelcare.internal"}>`);
  console.log(`[SUBJECT]: ${subject}`);
  if (replyToEmail) console.log(`[REPLY-TO]: ${replyToName ? `${replyToName} <${replyToEmail}>` : replyToEmail}`);
  console.log(`===================================================================\n`);
  return { success: true, provider: "mock", mocked: true };
}

/**
 * Returns star rating visual representation.
 */
function renderStars(rating = 5) {
  const fullStar = "★";
  const emptyStar = "☆";
  const num = Math.max(1, Math.min(5, Number(rating) || 5));
  return fullStar.repeat(num) + emptyStar.repeat(5 - num);
}

/**
 * Sends a notification email to the Admin/Owner containing feedback details.
 */
async function sendFeedbackNotificationToAdmin({
  name,
  email,
  role = "visitor",
  rating = 5,
  category = "Suggestion",
  subject = "HostelCare Feedback",
  message,
  ipAddress = "",
}) {
  const receiverEmail =
    process.env.ADMIN_EMAIL ||
    process.env.FEEDBACK_RECEIVER_EMAIL ||
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    "omverma.dev@gmail.com";

  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    "omverma.dev@gmail.com";

  const stars = renderStars(rating);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feedback Received</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); text-align: center;">
              <div style="font-size: 38px; line-height: 1; margin-bottom: 8px;">🛡️</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">HostelCare</h1>
              <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 14px; font-weight: 500;">New Feedback & Inquiry Alert</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Metadata Badge Bar -->
              <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                <span style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px;">
                  Role: ${role.toUpperCase()}
                </span>
                <span style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px; margin-left: 6px;">
                  Category: ${category}
                </span>
              </div>

              <!-- Rating block -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid #334155;">
                <div style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Satisfaction Rating</div>
                <div style="color: #fbbf24; font-size: 20px; letter-spacing: 2px; margin-top: 4px;">${stars} <span style="font-size: 14px; color: #e2e8f0; font-weight: 600;">(${rating}/5)</span></div>
              </div>

              <!-- Submitter Details Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 14px; width: 120px;">Sender Name</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #f8fafc; font-size: 14px; font-weight: 600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 14px;">Sender Email</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #38bdf8; font-size: 14px; font-weight: 600;">
                    <a href="mailto:${email}" style="color: #38bdf8; text-decoration: none;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 14px;">Subject</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #f8fafc; font-size: 14px; font-weight: 600;">${subject}</td>
                </tr>
                ${ipAddress ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 14px;">IP Address</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #334155; color: #64748b; font-size: 13px; font-family: monospace;">${ipAddress}</td>
                </tr>` : ""}
              </table>

              <!-- Message Details -->
              <div style="margin-bottom: 28px;">
                <div style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Feedback Message:</div>
                <div style="background-color: #0f172a; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; padding: 18px; color: #f1f5f9; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
              </div>

              <!-- Reply Action Button -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="mailto:${email}?subject=Re: [HostelCare] ${encodeURIComponent(subject)}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
                  ✉️ Reply to ${name}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">HostelCare Automated Notification System &bull; Powered by Brevo API</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return dispatchEmail({
    toEmail: receiverEmail,
    toName: "HostelCare Administrator",
    senderEmail,
    senderName: "HostelCare Portal",
    replyToEmail: email,
    replyToName: name,
    subject: `🛡️ [HostelCare] Feedback from ${name} (${category} - ${rating}★)`,
    htmlContent: html,
  });
}

/**
 * Sends a modern, branded acknowledgment email to the visitor/user confirming their submission.
 */
async function sendFeedbackAcknowledgmentToVisitor({
  name,
  email,
  rating = 5,
  category = "Suggestion",
  subject = "HostelCare Feedback",
  message,
}) {
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    "omverma.dev@gmail.com";

  const stars = renderStars(rating);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank you for your feedback</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
          
          <!-- Hero Header with glowing gradient -->
          <tr>
            <td style="padding: 40px 32px 32px 32px; background: linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #7c3aed 100%); text-align: center;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px); border-radius: 50%; width: 72px; height: 72px; line-height: 72px; font-size: 34px; margin-bottom: 16px; border: 1px solid rgba(255, 255, 255, 0.25);">
                ✨
              </div>
              <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">We Received Your Feedback!</h1>
              <p style="margin: 0; color: #e0e7ff; font-size: 15px; line-height: 1.5; max-width: 440px; margin: 0 auto;">
                Hi <strong>${name}</strong>, thank you for sharing your thoughts with the HostelCare team.
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Every piece of feedback helps us elevate the student and hostel living experience. Our team carefully reviews all incoming inquiries and suggestions to continuously improve our platform.
              </p>

              <!-- Feedback Summary Card -->
              <div style="background-color: #f1f5f9; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.75px; margin-bottom: 12px;">
                  📋 Summary of Your Submission
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 100px;">Topic:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${category}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Rating:</td>
                    <td style="padding: 6px 0; color: #d97706; font-weight: 700; font-size: 16px;">
                      ${stars} <span style="font-size: 13px; color: #475569; font-weight: 600;">(${rating}/5)</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Subject:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${subject}</td>
                  </tr>
                </table>

                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
                  <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px;">Your Message:</div>
                  <div style="color: #1e293b; font-size: 14px; line-height: 1.5; font-style: italic; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">"${message}"</div>
                </div>
              </div>

              <!-- Next steps banner -->
              <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <div style="font-weight: 700; color: #3730a3; font-size: 14px; margin-bottom: 4px;">💬 What happens next?</div>
                <div style="font-size: 13px; color: #4338ca; line-height: 1.5;">
                  If your submission requires attention or inquiry resolution, one of our hostel coordinators will get back to you directly at <strong>${email}</strong>.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0f172a; text-align: center;">
              <div style="font-size: 18px; margin-bottom: 6px;">🛡️ <strong style="color: #f8fafc; font-size: 14px;">HostelCare Ecosystem</strong></div>
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 12px;">Next-Generation Hostel Management & Operations Portal</p>
              <p style="margin: 0; color: #64748b; font-size: 11px;">You received this automated message because feedback was submitted with your email address on HostelCare.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return dispatchEmail({
    toEmail: email,
    toName: name,
    senderEmail,
    senderName: "HostelCare Team",
    subject: `✨ Thank you for your feedback, ${name}! - HostelCare`,
    htmlContent: html,
  });
}

module.exports = {
  sendFeedbackNotificationToAdmin,
  sendFeedbackAcknowledgmentToVisitor,
};
