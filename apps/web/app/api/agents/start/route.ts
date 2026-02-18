/**
 * POST /api/agents/start
 *
 * Initiates a Smart agent job for script analysis or schedule planning.
 * Returns immediately with jobId - processing continues via next/server after().
 */

// Allow up to 5 minutes for the background pipeline (after() inherits this)
export const maxDuration = 300;

import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ScriptAnalysisAgent } from '@/lib/agents/script-analysis';
import { JobManager } from '@/lib/agents/orchestrator/job-manager';
import { getFireworksApiKey } from '@/lib/ai/config';
import type { AgentJobType, StartAgentJobRequest, StartAgentJobResponse } from '@/lib/agents/types';

const SCRIPT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type ScriptUrlProbeResult = {
  ok: boolean;
  status?: number;
  method?: 'HEAD' | 'GET_RANGE';
  error?: string;
};

async function probeScriptUrl(url: string): Promise<ScriptUrlProbeResult> {
  try {
    const headRes = await fetch(url, { method: 'HEAD' });
    if (headRes.ok) {
      return { ok: true, status: headRes.status, method: 'HEAD' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[AgentStart] HEAD probe failed, falling back to range GET:', message);
  }

  try {
    const rangeRes = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });

    if (rangeRes.ok || rangeRes.status === 206) {
      return { ok: true, status: rangeRes.status, method: 'GET_RANGE' };
    }

    return {
      ok: false,
      status: rangeRes.status,
      method: 'GET_RANGE',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, method: 'GET_RANGE' };
  }
}

function extractStorageObjectPath(fileUrl: string): { bucket: string; objectPath: string } | null {
  try {
    const parsed = new URL(fileUrl);
    const marker = '/storage/v1/object/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const segments = storagePath.split('/').filter(Boolean);
    if (segments.length < 3) return null;

    const [accessType, bucket, ...rest] = segments;
    if (!['sign', 'public', 'authenticated'].includes(accessType)) {
      return null;
    }

    const objectPath = decodeURIComponent(rest.join('/'));
    if (!bucket || !objectPath) return null;

    return { bucket, objectPath };
  } catch {
    return null;
  }
}

async function refreshSignedScriptUrl(scriptId: string, currentUrl: string): Promise<string | null> {
  const storagePath = extractStorageObjectPath(currentUrl);
  if (!storagePath) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(storagePath.bucket)
      .createSignedUrl(storagePath.objectPath, SCRIPT_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.error('[AgentStart] Failed to refresh signed script URL:', error);
      return null;
    }

    const refreshedUrl = data.signedUrl;
    const { error: updateError } = await admin
      .from('Script')
      .update({ fileUrl: refreshedUrl })
      .eq('id', scriptId);

    if (updateError) {
      console.warn('[AgentStart] Refreshed URL but failed to persist to Script.fileUrl:', updateError);
    }

    return refreshedUrl;
  } catch (error) {
    console.error('[AgentStart] Unexpected error refreshing script URL:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: StartAgentJobRequest = await request.json();
    const { projectId, scriptId, jobType } = body;

    // Validate required fields
    if (!projectId || !scriptId || !jobType) {
      return NextResponse.json(
        { error: 'projectId, scriptId, and jobType are required' },
        { status: 400 }
      );
    }

    // Validate job type
    const validJobTypes: AgentJobType[] = ['script_analysis', 'schedule_planning'];
    if (!validJobTypes.includes(jobType)) {
      return NextResponse.json(
        { error: `Invalid jobType. Must be one of: ${validJobTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify user has access to the project
    const { data: member, error: memberError } = await supabase
      .from('ProjectMember')
      .select('role')
      .eq('projectId', projectId)
      .eq('userId', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to this project' },
        { status: 403 }
      );
    }

    // Check role permissions
    const allowedRoles = ['ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD'];
    if (!allowedRoles.includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to start agent jobs' },
        { status: 403 }
      );
    }

    // Verify script exists and belongs to project
    const { data: script, error: scriptError } = await supabase
      .from('Script')
      .select('id, projectId, fileUrl')
      .eq('id', scriptId)
      .single();

    if (scriptError || !script) {
      return NextResponse.json(
        { error: 'Script not found' },
        { status: 404 }
      );
    }

    if (script.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Script does not belong to this project' },
        { status: 400 }
      );
    }

    if (!script.fileUrl) {
      return NextResponse.json(
        { error: 'Script file URL is missing' },
        { status: 400 }
      );
    }

    // Pre-flight: verify Fireworks API key is configured
    const fireworksKey = getFireworksApiKey();
    if (!fireworksKey) {
      console.error('[AgentStart] FIREWORKS_SECRET_KEY is not set in environment');
      return NextResponse.json(
        { error: 'Smart service is not configured. Set FIREWORKS_SECRET_KEY in your environment.' },
        { status: 503 }
      );
    }

    // Pre-flight: verify script URL is accessible. If not, attempt to refresh
    // Supabase signed URLs (they expire and are persisted in Script.fileUrl).
    let scriptFileUrl = script.fileUrl;
    let probe = await probeScriptUrl(scriptFileUrl);

    if (!probe.ok) {
      const refreshedUrl = await refreshSignedScriptUrl(script.id, scriptFileUrl);
      if (refreshedUrl) {
        scriptFileUrl = refreshedUrl;
        probe = await probeScriptUrl(scriptFileUrl);
      }
    }

    if (!probe.ok) {
      const statusPart = probe.status ? ` (${probe.status})` : '';
      const detail = probe.error ? `: ${probe.error}` : '';
      console.error('[AgentStart] Script file not accessible', { status: probe.status, detail, url: scriptFileUrl });
      return NextResponse.json(
        {
          error: `Script file is not accessible${statusPart}. The link may have expired${detail}. Try re-uploading the script.`,
        },
        { status: 400 }
      );
    }

    // Handle job type
    if (jobType === 'script_analysis') {
      try {
        // Cancel any stale jobs that are stuck (older than 10 minutes)
        await JobManager.cancelStaleJobs(scriptId);

        // Create and start the agent
        const { jobId, agent } = await ScriptAnalysisAgent.start(
          projectId,
          scriptId,
          user.id
        );

        // Schedule pipeline to run after the response is sent.
        // next/server `after()` keeps the runtime alive for this work.
        after(async () => {
          try {
            await agent.run();
          } catch (error) {
            console.error(`[AgentStart] Background job ${jobId} failed:`, error);
          }
        });

        const response: StartAgentJobResponse = {
          jobId,
          status: 'pending',
        };

        return NextResponse.json(response);

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start analysis';

        // Check if it's a duplicate job error
        if (message.includes('already in progress')) {
          return NextResponse.json(
            { error: message },
            { status: 409 } // Conflict
          );
        }

        console.error('[AgentStart] Error starting script analysis:', error);
        return NextResponse.json(
          { error: message },
          { status: 500 }
        );
      }
    }

    // Schedule planning not yet implemented
    if (jobType === 'schedule_planning') {
      return NextResponse.json(
        { error: 'Schedule planning agent is not yet implemented' },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: 'Unknown job type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[AgentStart] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
