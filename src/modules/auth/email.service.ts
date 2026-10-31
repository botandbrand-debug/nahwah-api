import { env } from '../../config/env';

/**
 * Sends a password reset email.
 * For now, logs to console (development).
 * When RESEND_API_KEY is set, uses Resend to deliver.
 *
 * To enable real email delivery:
 *   1. Sign up at https://resend.com
 *   2. Create an API key
 *   3. Set RESEND_API_KEY and RESEND_FROM in .env
 *   4. `npm install resend --save-exact`
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'noreply@nahwah.app';

  if (!apiKey) {
    // Development fallback: log to console
    console.log('\n=== PASSWORD RESET EMAIL ===');
    console.log(`To: ${email}`);
    console.log(`Reset link: ${resetUrl}`);
    console.log(`Expires in: 1 hour`);
    console.log('============================\n');
    return;
  }

  try {
    // Dynamic import so this works without the package installed in dev
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from,
      to: email,
      subject: 'Reset your Nahwah password',
      html: `
        <p>Someone (hopefully you) requested a password reset for your Nahwah account.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>Or paste this link in your browser: ${resetUrl}</p>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      `,
    });
  } catch (err) {
    // Never throw — the endpoint must always return 200 regardless
    console.error('[email] failed to send reset email:', err);
  }
}