import { NextResponse } from 'next/server';
import { runAutomationEngine } from '@/lib/engine';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runAutomationEngine(true);

    if (result.success) {
      return NextResponse.json({ message: 'Manual automation completed successfully', runId: result.runId });
    } else {
      return NextResponse.json({ error: result.error, runId: result.runId }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Unhandled error in manual-run API:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
