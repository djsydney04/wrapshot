import { getAppBaseUrl, getDefaultFromEmail, getResendClient } from "./resend";

interface SendEmailResult {
  sent: boolean;
  error?: string;
}

interface SendProjectInviteEmailInput {
  toEmail: string;
  projectName: string;
  role: string;
  inviterName: string;
  inviterEmail?: string | null;
  inviteToken: string;
}

interface SendOnboardingInviteEmailInput {
  toEmail: string;
  inviterName: string;
  inviterEmail?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendProjectInviteEmail(
  input: SendProjectInviteEmailInput
): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY is not configured" };
  }

  const projectName = escapeHtml(input.projectName);
  const inviterName = escapeHtml(input.inviterName);
  const inviteUrl = `${getAppBaseUrl()}/invites/${input.inviteToken}`;
  const safeInviteUrl = escapeHtml(inviteUrl);
  const roleLabel = escapeHtml(input.role.toLowerCase().replaceAll("_", " "));
  const inviterEmailLabel = input.inviterEmail
    ? ` (${escapeHtml(input.inviterEmail)})`
    : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 8px 0;">You were invited to ${projectName}</h2>
      <p style="margin: 0 0 16px 0; color: #4b5563;">
        ${inviterName}${inviterEmailLabel} invited you to collaborate in wrapshoot.
      </p>
      <p style="margin: 0 0 16px 0; color: #4b5563;">
        Assigned role: <strong>${roleLabel}</strong>
      </p>
      <p style="margin: 0 0 24px 0;">
        <a href="${safeInviteUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">
          Accept invite
        </a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        If the button doesn't work, use this link: ${safeInviteUrl}
      </p>
    </div>
  `;

  const text = [
    `You were invited to ${input.projectName}`,
    `${input.inviterName}${input.inviterEmail ? ` (${input.inviterEmail})` : ""} invited you to collaborate in wrapshoot.`,
    `Assigned role: ${input.role.toLowerCase().replaceAll("_", " ")}`,
    "",
    `Accept invite: ${inviteUrl}`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: getDefaultFromEmail(),
    to: input.toEmail,
    subject: `${input.inviterName} invited you to ${input.projectName}`,
    html,
    text,
    replyTo: input.inviterEmail || undefined,
  });

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true };
}

export async function sendOnboardingInviteEmail(
  input: SendOnboardingInviteEmailInput
): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY is not configured" };
  }

  const inviterName = escapeHtml(input.inviterName);
  const inviterEmailLabel = input.inviterEmail
    ? ` (${escapeHtml(input.inviterEmail)})`
    : "";
  const signupUrl = `${getAppBaseUrl()}/signup`;
  const safeSignupUrl = escapeHtml(signupUrl);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 8px 0;">You're invited to wrapshoot</h2>
      <p style="margin: 0 0 16px 0; color: #4b5563;">
        ${inviterName}${inviterEmailLabel} invited you to join their production workspace.
      </p>
      <p style="margin: 0 0 24px 0;">
        <a href="${safeSignupUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">
          Create your account
        </a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        If the button doesn't work, use this link: ${safeSignupUrl}
      </p>
    </div>
  `;

  const text = [
    "You're invited to wrapshoot",
    `${input.inviterName}${input.inviterEmail ? ` (${input.inviterEmail})` : ""} invited you to join their production workspace.`,
    "",
    `Create account: ${signupUrl}`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: getDefaultFromEmail(),
    to: input.toEmail,
    subject: `${input.inviterName} invited you to wrapshoot`,
    html,
    text,
    replyTo: input.inviterEmail || undefined,
  });

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true };
}
