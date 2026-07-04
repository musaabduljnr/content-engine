import { NextResponse } from 'next/server';
import { runAutomationEngine } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('cron_secret') || '';

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    const cronSecret = process.env.CRON_SECRET || '';

    // Verify secret
    if (secret !== cronSecret && token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runAutomationEngine(false);

    if (result.success) {
      return NextResponse.json({ message: 'Automation finished successfully', runId: result.runId });
    } else {
      return NextResponse.json({ error: result.error, runId: result.runId }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Unhandled error in cron content-run API:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
