import { NextRequest, NextResponse } from 'next/server';
import { 
  registerAgent, 
  getAgent, 
  updateAgent, 
  getTaskQueue, 
  updateTask,
  getSwarmStats 
} from '@/lib/swarm-state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soul_id, capabilities, status, referred_by } = body;

    if (!soul_id) {
      return NextResponse.json({ error: 'soul_id required' }, { status: 400 });
    }

    // Register/update agent
    const agent = registerAgent(soul_id, {
      capabilities: capabilities || [],
      referredBy: referred_by,
    });

    updateAgent(soul_id, {
      status: status || 'ready',
      lastSeen: Date.now(),
    });

    // Find a task for this agent
    const taskQueue = getTaskQueue();
    const availableTask = taskQueue.find(
      (t) => t.status === 'pending' && !t.assignedTo
    );

    if (availableTask && status === 'ready') {
      updateTask(availableTask.id, {
        assignedTo: soul_id,
        status: 'assigned',
      });

      return NextResponse.json({
        status: 'task_assigned',
        task: {
          id: availableTask.id,
          type: availableTask.type,
          description: availableTask.description,
          script: availableTask.script,
          payout: availableTask.payout,
        },
      });
    }

    const stats = getSwarmStats();

    return NextResponse.json({
      status: 'acknowledged',
      task: null,
      swarm_size: stats.totalAgents,
      active_agents: stats.activeAgents,
      your_stats: {
        completed_tasks: agent.completedTasks,
        total_earnings: agent.earnings,
        referral_earnings: agent.referralEarnings,
      },
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  const stats = getSwarmStats();
  return NextResponse.json(stats);
}
