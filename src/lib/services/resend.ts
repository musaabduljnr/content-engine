import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY || '';
const ownerEmail = process.env.OWNER_EMAIL || '';

export interface EmailPayload {
  topic: string;
  summary: string;
  post: string;
  canvaUrl: string;
  hyperFramesUrl: string;
  suggestedPostingTime: string;
}

export async function sendContentEmail(
  payload: EmailPayload,
  customApiKey?: string,
  customRecipient?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = customApiKey || resendApiKey;
  const recipient = customRecipient || ownerEmail;

  if (!apiKey) {
    console.error('Resend API key is missing.');
    return { success: false, error: 'Resend API key is not configured.' };
  }

  if (!recipient) {
    console.error('Owner email is missing.');
    return { success: false, error: 'Recipient/Owner email is not configured.' };
  }

  const resend = new Resend(apiKey);

  // Determine delivery time label based on UTC hour
  const currentHourUtc = new Date().getUTCHours();
  let timeOfDay = 'Morning';
  if (currentHourUtc >= 12 && currentHourUtc < 18) {
    timeOfDay = 'Afternoon';
  } else if (currentHourUtc >= 18 || currentHourUtc < 6) {
    timeOfDay = 'Evening';
  }

  const subject = `AI Content Delivery — ${timeOfDay}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
      <h2 style="color: #2b6cb0; margin-bottom: 20px; border-bottom: 2px solid #ebf8ff; padding-bottom: 10px;">
        🚀 AI Content Delivery — ${timeOfDay}
      </h2>
      
      <div style="margin-bottom: 24px;">
        <strong style="font-size: 14px; text-transform: uppercase; color: #718096; letter-spacing: 0.05em;">Topic</strong>
        <p style="font-size: 18px; font-weight: bold; margin-top: 4px; margin-bottom: 8px; color: #2d3748;">
          ${payload.topic}
        </p>
      </div>

      <div style="margin-bottom: 24px; padding: 12px; background-color: #f7fafc; border-radius: 6px; border-left: 4px solid #4299e1;">
        <strong style="font-size: 14px; text-transform: uppercase; color: #718096; letter-spacing: 0.05em;">Summary</strong>
        <p style="font-size: 15px; line-height: 1.6; margin-top: 4px; margin-bottom: 0; color: #4a5568;">
          ${payload.summary}
        </p>
      </div>

      <div style="margin-bottom: 24px; padding: 16px; background-color: #ebf8ff; border-radius: 6px; border: 1px solid #bee3f8;">
        <strong style="font-size: 14px; text-transform: uppercase; color: #2b6cb0; letter-spacing: 0.05em;">✨ Final X Post</strong>
        <p style="font-size: 16px; line-height: 1.5; font-weight: 500; white-space: pre-wrap; margin-top: 8px; margin-bottom: 0; color: #2d3748;">
          ${payload.post}
        </p>
        <span style="font-size: 12px; color: #718096; display: block; margin-top: 8px;">
          Length: ${payload.post.length} / 280 characters
        </span>
      </div>

      <div style="margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #fff;">
          <strong style="font-size: 13px; color: #718096;">🎨 Canva Graphic</strong>
          <a href="${payload.canvaUrl}" target="_blank" style="display: block; margin-top: 6px; font-size: 14px; color: #3182ce; font-weight: 600; text-decoration: none;">
            Open Canva Design &rarr;
          </a>
        </div>
        <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #fff;">
          <strong style="font-size: 13px; color: #718096;">🎥 HyperFrames Video</strong>
          <a href="${payload.hyperFramesUrl}" target="_blank" style="display: block; margin-top: 6px; font-size: 14px; color: #3182ce; font-weight: 600; text-decoration: none;">
            View Video Link &rarr;
          </a>
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #718096;">
        📅 <strong>Suggested Posting Time:</strong> ${payload.suggestedPostingTime}
      </div>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: 'X Automation <onboarding@resend.dev>', // Resend Sandbox Sender
      to: recipient,
      subject: subject,
      html: htmlContent,
    });

    if ('error' in data && data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    return { success: true, id: (data as any).id };
  } catch (error: any) {
    console.error('Error sending email through Resend:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
