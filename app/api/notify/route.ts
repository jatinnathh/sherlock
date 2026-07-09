import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, details, scenario, result } = body;

    const senderEmail = process.env.SMTP_USER || process.env.SMTP_EMAIL;
    const senderPassword = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    const receiverEmail = process.env.NOTIFICATION_EMAIL || senderEmail;

    if (!senderEmail || !senderPassword || !receiverEmail) {
      console.warn('[Notify API] Missing SMTP credentials in .env. Skipping email notification.');
      return NextResponse.json({ status: 'skipped', reason: 'No credentials' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: senderEmail,
        pass: senderPassword,
      },
    });

    const subject = `Sherlock Alert: ${event}`;
    const textBody = `Event: ${event}\nScenario Type: ${scenario}\nResult / Confidence: ${result}\n\nDetails:\n${details}`;

    const info = await transporter.sendMail({
      from: `"Sherlock Platform" <${senderEmail}>`,
      to: receiverEmail,
      subject: subject,
      text: textBody,
    });

    console.log('[Notify API] Message sent: %s', info.messageId);

    return NextResponse.json({ status: 'success', messageId: info.messageId });
  } catch (error) {
    console.error('[Notify API] Failed to send email:', error);
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}
