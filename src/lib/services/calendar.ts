import { google } from 'googleapis';
import { supabaseAdmin } from './supabase';

const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';

// Base URL of the application, used for OAuth callbacks
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};

export function getOAuth2Client() {
  const redirectUri = `${getBaseUrl()}/api/calendar/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Generate Auth URL for the user to consent and link Google Calendar
export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Critical to get the refresh_token
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
}

// Create calendar reminder 15 minutes in the future
export async function createCalendarReminder(
  postContentSnippet: string,
  scheduledTime: Date
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    // 1. Fetch Google refresh token from Supabase settings
    const { data: tokenSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'google_refresh_token')
      .single();

    if (!tokenSetting || !tokenSetting.value) {
      console.warn('Google Calendar refresh token is not configured. Link account in dashboard settings.');
      return { success: false, error: 'Google Calendar is not linked. Please link your account in settings.' };
    }

    const refreshToken = tokenSetting.value;
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Scheduled for 15 minutes after the cron execution (which is passed in as scheduledTime)
    const reminderTime = new Date(scheduledTime.getTime() + 15 * 60 * 1000);
    const endTime = new Date(reminderTime.getTime() + 30 * 60 * 1000); // 30-min duration

    const event = {
      summary: 'Post AI content on X 🚀',
      description: `Review the email, download generated assets, and publish this post:\n\n"${postContentSnippet}"`,
      start: {
        dateTime: reminderTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 0 }, // Pop up immediately at start time
        ],
      },
    };

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return {
      success: true,
      eventId: res.data.id || undefined,
    };
  } catch (error: any) {
    console.error('Error creating Google Calendar reminder:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}
