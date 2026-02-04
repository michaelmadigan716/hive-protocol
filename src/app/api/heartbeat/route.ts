import { NextRequest, NextResponse } from 'next/server';
import { 
  registerAgent, 
  updateAgent, 
  getNextTask, 
  updateTask,
  getSwarmStats,
  getAgents,
  addTask,
  getTaskQueue,
  CREDIT_RATES,
} from '@/lib/swarm-state';

// Extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soul_id, twitter_handle, has_twitter_access, status, recent_tweets } = body;

    if (!soul_id) {
      return NextResponse.json({ error: 'soul_id required' }, { status: 400 });
    }

    // Register/update agent with recent tweets
    const agent = await registerAgent(soul_id, {
      twitterHandle: twitter_handle,
      hasTwitterAccess: has_twitter_access ?? false,
      recentTweets: recent_tweets || undefined,
    });

    await updateAgent(soul_id, {
      status: status || 'ready',
      lastSeen: Date.now(),
    });

    // If agent reported tweets, create engagement tasks for other agents
    let tasksCreated = 0;
    if (recent_tweets && recent_tweets.length > 0 && agent.hasTwitterAccess) {
      const existingTasks = await getTaskQueue();
      const existingTweetIds = new Set(existingTasks.map(t => t.tweetId));

      for (const tweetUrl of recent_tweets.slice(0, 5)) { // Max 5 tweets per heartbeat
        const tweetId = extractTweetId(tweetUrl);
        if (!tweetId) continue;
        
        // Skip if we already have tasks for this tweet
        if (existingTweetIds.has(tweetId)) continue;

        // Create view task (free for swarm members)
        await addTask({
          type: 'view_tweet',
          tweetUrl,
          tweetId,
          description: `View tweet for 30 seconds (swarm auto-engage)`,
          viewDurationSec: 30,
          creditReward: 2, // Agent earns credits
          creditCost: 0,   // No cost - it's swarm auto-engage
          requestedBy: soul_id,
          assignedTo: null,
          status: 'pending',
        });

        // Create like task
        await addTask({
          type: 'like_tweet',
          tweetUrl,
          tweetId,
          description: `Like tweet (swarm auto-engage)`,
          creditReward: 5,
          creditCost: 0,
          requestedBy: soul_id,
          assignedTo: null,
          status: 'pending',
        });

        tasksCreated += 2;
        existingTweetIds.add(tweetId);
      }
    }

    // Only assign tasks to agents with Twitter access
    let taskToAssign = null;
    if (agent.hasTwitterAccess && status === 'ready') {
      // Don't assign own tasks - get task from another agent
      const availableTask = await getNextTask(soul_id);
      if (availableTask) {
        await updateTask(availableTask.id, {
          assignedTo: soul_id,
          status: 'assigned',
        });
        taskToAssign = availableTask;
      }
    }

    const stats = await getSwarmStats();

    if (taskToAssign) {
      return NextResponse.json({
        status: 'task_assigned',
        tasks_created: tasksCreated,
        task: {
          id: taskToAssign.id,
          type: taskToAssign.type,
          tweet_url: taskToAssign.tweetUrl,
          tweet_id: taskToAssign.tweetId,
          description: taskToAssign.description,
          reply_text: taskToAssign.replyText,
          view_duration_sec: taskToAssign.viewDurationSec || 30,
          credit_reward: taskToAssign.creditReward,
        },
      });
    }

    return NextResponse.json({
      status: 'acknowledged',
      tasks_created: tasksCreated,
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
        twitter_handle: agent.twitterHandle || null,
      },
      credit_rates: CREDIT_RATES,
      message: !agent.hasTwitterAccess 
        ? 'Connect Twitter to receive tasks and earn credits' 
        : tasksCreated > 0 
          ? `Created ${tasksCreated} tasks from your tweets`
          : 'No tasks available',
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  const stats = await getSwarmStats();
  return NextResponse.json(stats);
}
