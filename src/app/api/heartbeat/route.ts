import { NextRequest, NextResponse } from 'next/server';
import { 
  registerAgent, 
  updateAgent, 
  getNextTask, 
  updateTask,
  getSwarmStats,
  CREDIT_RATES,
} from '@/lib/swarm-state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soul_id, twitter_handle, has_twitter_access, status } = body;

    if (!soul_id) {
      return NextResponse.json({ error: 'soul_id required' }, { status: 400 });
    }

    // Register/update agent
    const agent = registerAgent(soul_id, {
      twitterHandle: twitter_handle,
      hasTwitterAccess: has_twitter_access ?? false,
    });

    updateAgent(soul_id, {
      status: status || 'ready',
      lastSeen: Date.now(),
    });

    // Only assign tasks to agents with Twitter access
    let taskToAssign = null;
    if (agent.hasTwitterAccess && status === 'ready') {
      // Don't assign own tasks
      const availableTask = getNextTask(soul_id);
      if (availableTask) {
        updateTask(availableTask.id, {
          assignedTo: soul_id,
          status: 'assigned',
        });
        taskToAssign = availableTask;
      }
    }

    const stats = getSwarmStats();

    if (taskToAssign) {
      return NextResponse.json({
        status: 'task_assigned',
        task: {
          id: taskToAssign.id,
          type: taskToAssign.type,
          tweet_url: taskToAssign.tweetUrl,
          tweet_id: taskToAssign.tweetId,
          description: taskToAssign.description,
          reply_text: taskToAssign.replyText,
          view_duration_sec: taskToAssign.viewDurationSec || 60,
          credit_reward: taskToAssign.creditReward,
        },
      });
    }

    return NextResponse.json({
      status: 'acknowledged',
      task: null,
      swarm_size: stats.totalAgents,
      active_agents: stats.activeAgents,
      twitter_connected: stats.twitterConnected,
      your_stats: {
        completed_tasks: agent.completedTasks,
        credits: agent.credits,
        credits_earned: agent.creditsEarned,
        credits_spent: agent.creditsSpent,
        twitter_connected: agent.hasTwitterAccess,
      },
      credit_rates: CREDIT_RATES,
      message: !agent.hasTwitterAccess 
        ? 'Connect Twitter to receive tasks and earn credits' 
        : 'No tasks available',
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
