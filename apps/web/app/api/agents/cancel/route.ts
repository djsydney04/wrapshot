/**
 * POST /api/agents/cancel
 *
 * Cancel a running agent job.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { JobManager } from '@/lib/agents/orchestrator/job-manager';
import type { CancelAgentJobResponse } from '@/lib/agents/types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    // Get the job
    const job = await JobManager.getJob(jobId);

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

    // Check role permissions
    const allowedRoles = ['ADMIN', 'COORDINATOR'];
    if (!allowedRoles.includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to cancel jobs' },
        { status: 403 }
      );
    }

    // Check if job can be cancelled
    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    if (terminalStatuses.includes(job.status)) {
      const response: CancelAgentJobResponse = {
        success: false,
        message: `Job is already ${job.status}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Cancel the job
    await JobManager.cancelJob(jobId);

    const response: CancelAgentJobResponse = {
      success: true,
      message: 'Job cancelled successfully',
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[AgentCancel] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
