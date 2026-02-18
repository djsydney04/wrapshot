/**
 * POST /api/agents/start
 *
 * Initiates an AI agent job for script analysis or schedule planning.
 * Returns immediately with jobId - processing continues via next/server after().
 */

// Allow up to 5 minutes for the background pipeline (after() inherits this)
export const maxDuration = 300;

import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ScriptAnalysisAgent } from '@/lib/agents/script-analysis';
import { JobManager } from '@/lib/agents/orchestrator/job-manager';
import { getFireworksApiKey } from '@/lib/ai/config';
import type { AgentJobType, StartAgentJobRequest, StartAgentJobResponse } from '@/lib/agents/types';

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
        { error: 'AI service is not configured. Set FIREWORKS_SECRET_KEY in your environment.' },
        { status: 503 }
      );
    }

    // Pre-flight: verify the script PDF is accessible
    try {
      const headRes = await fetch(script.fileUrl, { method: 'HEAD' });
      if (!headRes.ok) {
        console.error('[AgentStart] Script file not accessible:', headRes.status, script.fileUrl);
        return NextResponse.json(
          { error: `Script file is not accessible (${headRes.status}). The download link may have expired — try re-uploading the script.` },
          { status: 400 }
        );
      }
    } catch (fetchErr) {
      console.error('[AgentStart] Failed to reach script file:', fetchErr);
      return NextResponse.json(
        { error: 'Could not reach the script file. Check your network or re-upload the script.' },
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
