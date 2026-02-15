const { onCall, HttpsError } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");

// Create a reusable transporter object using the default SMTP transport
// In production, these should be set via firebase functions:config:set or Secret Manager
const transporter = nodemailer.createTransport({
    service: "gmail", // Or use 'smtp.mailgun.org', etc.
    auth: {
        user: process.env.EMAIL_USER || "contact@byteandberry.com",
        pass: process.env.EMAIL_PASS, // App Password
    },
});

/**
 * Internal helper to send email
 */
async function sendEmailInternal({ to, subject, html, text }) {
    if (!process.env.EMAIL_PASS) {
        console.warn("Email password not configured. Email sending skipped.");
        return { success: false, message: "Email configuration missing." };
    }

    const mailOptions = {
        from: `"ZedBooks Support" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ""), // Fallback plain text
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error(`Email sending failed: ${error.message}`);
    }
}

/**
 * Callable function to send an email
 * Usage: functions.httpsCallable('sendEmail')({ to: "user@example.com", subject: "Welcome!", html: "<h1>Hi!</h1>" })
 */
exports.sendEmail = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { to, subject, html, text } = request.data;

    if (!to || !subject || !html) {
        throw new HttpsError("invalid-argument", "Missing required email fields (to, subject, html).");
    }

    try {
        const result = await sendEmailInternal({ to, subject, html, text });
        return result;
    } catch (error) {
        // Don't expose internal error details to client unless necessary
        throw new HttpsError("internal", "Failed to send email.");
    }
});

/**
 * Trigger: When an invitation is created, send an email
 * Note: This would typically be a Firestore trigger. For now, we expose a helper function
 * or we can hook it into the createInvitation logic if we were modifying index.js directly.
 * 
 * To make this a trigger:
 */
exports.sendEmailInternal = sendEmailInternal;
