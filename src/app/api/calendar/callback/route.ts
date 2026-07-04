import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/services/calendar';
import { supabaseAdmin } from '@/lib/services/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth callback error:', error);
      return NextResponse.redirect(new URL('/settings?calendar_error=' + encodeURIComponent(error), request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?calendar_error=no_code_provided', request.url));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn('No refresh token returned. Account might already be linked. If so, prompt user to disconnect first.');
      // Save access token if that's all we got, but usually we want refresh token
    }

    // Save tokens in settings table. If refresh token is missing, retrieve the existing one or tell them to re-consent
    if (tokens.refresh_token) {
      await supabaseAdmin.from('settings').upsert({
        key: 'google_refresh_token',
        value: tokens.refresh_token,
        updated_at: new Date().toISOString(),
      });
    }

    if (tokens.access_token) {
      await supabaseAdmin.from('settings').upsert({
        key: 'google_access_token',
        value: tokens.access_token,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.redirect(new URL('/settings?calendar_success=true', request.url));
  } catch (err: any) {
    console.error('Error handling Google Calendar OAuth Callback:', err);
    return NextResponse.redirect(new URL('/settings?calendar_error=' + encodeURIComponent(err.message || 'unknown'), request.url));
  }
}
