'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import styles from './dashboard.module.css';

// Initialize frontend Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Run {
  id: string;
  status: 'running' | 'success' | 'failed';
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  post: {
    content: string;
    hook: string;
    summary: string;
    why_it_matters: string;
    visual_direction: string | null;
    video_direction: string | null;
    topic?: {
      name: string;
      category: string;
    };
  } | null;
  assets: {
    id: string;
    type: 'image' | 'video';
    provider: 'canva' | 'hyperframes';
    asset_url: string | null;
    status: 'pending' | 'success' | 'failed';
    error_message: string | null;
  }[];
  email_logs: {
    id: string;
    recipient: string;
    status: 'success' | 'failed';
    error_message: string | null;
  }[];
  calendar_logs: {
    id: string;
    event_id: string | null;
    title: string;
    status: 'success' | 'failed';
    error_message: string | null;
  }[];
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App settings state
  const [settings, setSettings] = useState<Record<string, string>>({
    owner_email: '',
    gemini_api_key: '',
    canva_api_key: '',
    hyperframes_api_key: '',
    canva_enabled: 'true',
    hyperframes_enabled: 'true',
    schedule_morning_utc: '08',
    schedule_afternoon_utc: '14',
    schedule_evening_utc: '20',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Automation & History state
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runningEngine, setRunningEngine] = useState(false);
  const [engineMessage, setEngineMessage] = useState<string | null>(null);

  // Retry loading states
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Calendar authorization state
  const [calendarUrl, setCalendarUrl] = useState<string>('');

  // 1. Session check on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch dashboard data when authenticated
  useEffect(() => {
    if (session) {
      fetchSettings();
      fetchRuns();
      fetchCalendarAuthUrl();
    }
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const settingsMap: Record<string, string> = {};
        data.settings.forEach((s: any) => {
          settingsMap[s.key] = s.value;
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchRuns = async () => {
    setRunsLoading(true);
    try {
      const res = await fetch('/api/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Failed to load history runs:', err);
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchCalendarAuthUrl = async () => {
    try {
      const res = await fetch('/api/calendar/auth-url');
      if (res.ok) {
        const data = await res.json();
        setCalendarUrl(data.url || '');
      }
    } catch (err) {
      console.error('Failed to load Google auth url:', err);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setSettingsMessage({ text: 'Settings updated successfully!', type: 'success' });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }
    } catch (err: any) {
      setSettingsMessage({ text: err.message || 'Error saving settings', type: 'error' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const triggerManualRun = async () => {
    setRunningEngine(true);
    setEngineMessage('Scraping Reddit and generating content package...');
    try {
      const res = await fetch('/api/content/manual-run', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setEngineMessage('Content generated & dispatched successfully!');
        fetchRuns();
      } else {
        setEngineMessage(`Automation Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setEngineMessage(`Network error: ${err.message}`);
    } finally {
      setRunningEngine(false);
      setTimeout(() => setEngineMessage(null), 8000);
    }
  };

  // Retry API endpoint calls
  const retryStep = async (endpoint: string, runId: string, stepName: string) => {
    setRetryingId(`${runId}-${stepName}`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`${stepName} retry completed successfully!`);
        fetchRuns();
      } else {
        alert(`Retry failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Network error during retry: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return <div className={styles.loginContainer}>Loading session...</div>;
  }

  // 3. Render Authentication Screen if not logged in
  if (!session) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.logo}>⚡ X-Delivery Admin</div>
          <h2 className={styles.loginTitle}>Owner Access</h2>
          <p className={styles.loginSubtitle}>Provide credentials to configure automation engine.</p>

          {authError && (
            <div className={`${styles.feedbackMessage} ${styles.feedbackError}`}>
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className={styles.formGroup} style={{ textAlign: 'left' }}>
              <label className={styles.formLabel}>Admin Email</label>
              <input
                type="email"
                className={styles.textInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@domain.com"
              />
            </div>
            <div className={styles.formGroup} style={{ textAlign: 'left' }}>
              <label className={styles.formLabel}>Password</label>
              <input
                type="password"
                className={styles.textInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className={styles.btnPrimary}
              style={{ width: '100%', marginTop: '1rem' }}
            >
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Calculate quick stats
  const totalRuns = runs.length;
  const successfulRuns = runs.filter(r => r.status === 'success').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;

  // 4. Render Main Dashboard Workspace
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>⚡ X-Delivery Automation Engine</div>
        <div className={styles.authInfo}>
          <span className={styles.userEmail}>{session.user.email}</span>
          <button className={styles.btnDisconnect} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Executions</div>
          <div className={styles.statVal}>{totalRuns}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Success Rate</div>
          <div className={styles.statVal} style={{ color: '#10b981' }}>{successRate}%</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Failed Runs</div>
          <div className={styles.statVal} style={{ color: '#ef4444' }}>{failedRuns}</div>
        </div>
      </div>

      <div className={styles.dashboardGrid}>
        {/* Left Column: manual triggering & run logs */}
        <div>
          {/* Action Trigger Card */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Run Engine Orchestrator</div>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Execute the Reddit research scraper, run Gemini post writing, Canva/HyperFrames generation, send the email and calendar reminders instantly.
            </p>
            {engineMessage && (
              <div className={styles.evergreenNotice}>
                ℹ️ {engineMessage}
              </div>
            )}
            <button
              onClick={triggerManualRun}
              disabled={runningEngine}
              className={styles.btnPrimary}
            >
              {runningEngine ? 'Executing Workflow...' : '⚡ Trigger Manual Run Now'}
            </button>
          </div>

          {/* Logs History Card */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              Execution Log History
              <button className={styles.btnSecondary} onClick={fetchRuns}>🔄 Refresh</button>
            </div>

            {runsLoading ? (
              <div style={{ color: '#9ca3af', padding: '1rem', textAlign: 'center' }}>Loading run history...</div>
            ) : runs.length === 0 ? (
              <div style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>No content runs registered. Click "Trigger Manual Run" to generate content.</div>
            ) : (
              <div className={styles.runList}>
                {runs.map((run) => {
                  const canvaAsset = run.assets.find(a => a.provider === 'canva');
                  const hyperFramesAsset = run.assets.find(a => a.provider === 'hyperframes');
                  const emailLog = run.email_logs[0];
                  const calLog = run.calendar_logs[0];

                  return (
                    <div key={run.id} className={styles.runItem}>
                      <div className={styles.runHeader}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>
                            Topic: {run.post?.topic?.name || 'Evergreen Fallback / General AI'}
                          </div>
                          <div className={styles.runMeta}>
                            Run ID: {run.id} • Started: {new Date(run.started_at).toLocaleString()}
                          </div>
                        </div>
                        <span className={`${styles.badge} ${run.status === 'success' ? styles.badgeSuccess : run.status === 'running' ? styles.badgeRunning : styles.badgeFailed}`}>
                          {run.status}
                        </span>
                      </div>

                      {run.error_message && (
                        <div className={`${styles.feedbackMessage} ${styles.feedbackError}`} style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                          Crash Reason: {run.error_message}
                        </div>
                      )}

                      {run.post && (
                        <>
                          <div className={styles.postContent}>{run.post.content}</div>
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
                            <strong>Hook:</strong> {run.post.hook} <br />
                            <strong>Summary:</strong> {run.post.summary} <br />
                            <strong>Why it matters:</strong> {run.post.why_it_matters}
                          </div>
                        </>
                      )}

                      {/* Assets and Actions summary */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Canva Link:</strong>{' '}
                          {canvaAsset?.status === 'success' ? (
                            <a href={canvaAsset.asset_url || '#'} target="_blank" className={styles.assetLink}>Open Graphic</a>
                          ) : (
                            <span style={{ color: '#ef4444', marginRight: '1rem' }}>Failed</span>
                          )}
                          <strong>HyperFrames Link:</strong>{' '}
                          {hyperFramesAsset?.status === 'success' ? (
                            <a href={hyperFramesAsset.asset_url || '#'} target="_blank" className={styles.assetLink}>Open Video</a>
                          ) : (
                            <span style={{ color: '#ef4444', marginRight: '1rem' }}>Failed</span>
                          )}
                        </div>

                        <div>
                          <strong>Email Status:</strong>{' '}
                          <span style={{ color: emailLog?.status === 'success' ? '#10b981' : '#ef4444', marginRight: '1.5rem' }}>
                            {emailLog?.status || 'Not Sent'}
                          </span>
                          <strong>Calendar Log:</strong>{' '}
                          <span style={{ color: calLog?.status === 'success' ? '#10b981' : '#ef4444' }}>
                            {calLog?.status || 'Not Scheduled'}
                          </span>
                        </div>
                      </div>

                      {/* Run retry tools */}
                      <div className={styles.runActions}>
                        <button
                          className={styles.btnMini}
                          disabled={retryingId !== null}
                          onClick={() => retryStep('/api/assets/canva', run.id, 'Canva')}
                        >
                          {retryingId === `${run.id}-Canva` ? 'Regenerating...' : '🎨 Retry Canva'}
                        </button>
                        <button
                          className={styles.btnMini}
                          disabled={retryingId !== null}
                          onClick={() => retryStep('/api/assets/hyperframes', run.id, 'HyperFrames')}
                        >
                          {retryingId === `${run.id}-HyperFrames` ? 'Regenerating...' : '🎥 Retry HyperFrames'}
                        </button>
                        <button
                          className={styles.btnMini}
                          disabled={retryingId !== null}
                          onClick={() => retryStep('/api/email/send', run.id, 'Email')}
                        >
                          {retryingId === `${run.id}-Email` ? 'Resending...' : '📧 Retry Email'}
                        </button>
                        <button
                          className={styles.btnMini}
                          disabled={retryingId !== null}
                          onClick={() => retryStep('/api/calendar/create-reminder', run.id, 'Calendar')}
                        >
                          {retryingId === `${run.id}-Calendar` ? 'Rescheduling...' : '📅 Retry Calendar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: settings config */}
        <div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Configuration Settings</div>

            {settingsMessage && (
              <div className={`${styles.feedbackMessage} ${settingsMessage.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                {settingsMessage.text}
              </div>
            )}

            <form onSubmit={saveSettings}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Recipient Email (OWNER_EMAIL)</label>
                <input
                  type="email"
                  className={styles.textInput}
                  value={settings.owner_email}
                  onChange={(e) => setSettings(prev => ({ ...prev, owner_email: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Gemini API Key</label>
                <input
                  type="password"
                  className={styles.textInput}
                  value={settings.gemini_api_key}
                  onChange={(e) => setSettings(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                  placeholder="Leave empty to use Vercel env variable"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Canva API Key</label>
                <input
                  type="password"
                  className={styles.textInput}
                  value={settings.canva_api_key}
                  onChange={(e) => setSettings(prev => ({ ...prev, canva_api_key: e.target.value }))}
                  placeholder="Leave empty to use Vercel env variable"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>HyperFrames API Key</label>
                <input
                  type="password"
                  className={styles.textInput}
                  value={settings.hyperframes_api_key}
                  onChange={(e) => setSettings(prev => ({ ...prev, hyperframes_api_key: e.target.value }))}
                  placeholder="Leave empty to use Vercel env variable"
                />
              </div>

              {/* Toggles */}
              <div style={{ margin: '1.5rem 0' }}>
                <div className={styles.toggleRow}>
                  <span className={styles.toggleLabel}>Enable Canva Generation</span>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={settings.canva_enabled !== 'false'}
                      onChange={(e) => setSettings(prev => ({ ...prev, canva_enabled: e.target.checked ? 'true' : 'false' }))}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.toggleRow}>
                  <span className={styles.toggleLabel}>Enable HyperFrames Video</span>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={settings.hyperframes_enabled !== 'false'}
                      onChange={(e) => setSettings(prev => ({ ...prev, hyperframes_enabled: e.target.checked ? 'true' : 'false' }))}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>

              {/* Schedule Info */}
              <div className={styles.formGroup} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <label className={styles.formLabel}>Scheduler Trigger Target Hours (UTC)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className={styles.textInput}
                    style={{ textAlign: 'center' }}
                    value={settings.schedule_morning_utc}
                    onChange={(e) => setSettings(prev => ({ ...prev, schedule_morning_utc: e.target.value }))}
                    placeholder="Morning"
                  />
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className={styles.textInput}
                    style={{ textAlign: 'center' }}
                    value={settings.schedule_afternoon_utc}
                    onChange={(e) => setSettings(prev => ({ ...prev, schedule_afternoon_utc: e.target.value }))}
                    placeholder="Afternoon"
                  />
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className={styles.textInput}
                    style={{ textAlign: 'center' }}
                    value={settings.schedule_evening_utc}
                    onChange={(e) => setSettings(prev => ({ ...prev, schedule_evening_utc: e.target.value }))}
                    placeholder="Evening"
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginTop: '0.4rem' }}>
                  Adjust trigger hours. Note: Dynamic scheduling adjustments require external scheduler config targeting the API cron route.
                </span>
              </div>

              <button
                type="submit"
                disabled={settingsSaving}
                className={styles.btnPrimary}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                {settingsSaving ? 'Saving Configurations...' : '💾 Save Settings'}
              </button>
            </form>
          </div>

          {/* Google Calendar Link Card */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Google Calendar Integration</div>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1.25rem' }}>
              Link your Google Calendar to allow the automation engine to schedule a reminder 15 minutes after content email delivery.
            </p>
            {calendarUrl ? (
              <a
                href={calendarUrl}
                className={styles.btnPrimary}
                style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
              >
                📅 Link Google Calendar
              </a>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Loading Auth Link... (Make sure Client ID and Secret are configured)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
