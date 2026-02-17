/**
 * GET /api/agents/status
 *
 * Get the status of an agent job.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { JobManager } from '@/lib/agents/orchestrator/job-manager';
import type { AgentJobStatusResponse } from '@/lib/agents/types';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const scriptId = searchParams.get('scriptId');

    // Either jobId or scriptId must be provided
    if (!jobId && !scriptId) {
      return NextResponse.json(
        { error: 'Either jobId or scriptId is required' },
        { status: 400 }
      );
    }

    let job;

    if (jobId) {
      // Get specific job
      job = await JobManager.getJob(jobId);
    } else if (scriptId) {
      // Get latest job for script
      job = await JobManager.getLatestJobForScript(scriptId);
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify user has access to the project
    const { data: member, error: memberError } = await supabase
      .from('ProjectMember')
      .select('role')
      .eq('projectId', job.projectId)
      .eq('userId', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to this job' },
        { status: 403 }
      );
    }

    const response: AgentJobStatusResponse = { job };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[AgentStatus] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
