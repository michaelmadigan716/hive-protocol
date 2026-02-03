import { NextRequest, NextResponse } from 'next/server';
import { 
  addTask, 
  getTaskQueue, 
  getSwarmStats, 
  getAgent, 
  deductCredits,
  CREDIT_RATES 
} from '@/lib/swarm-state';

// Extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// Create Twitter task (costs credits)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soul_id, type, tweet_url, reply_text, view_duration_sec, count } = body;

    // Must have soul_id to spend credits
    if (!soul_id) {
      return NextResponse.json({ error: 'soul_id required' }, { status: 400 });
    }

    // Validate type
    if (!type || !['view_tweet', 'like_tweet', 'reply_tweet'].includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid type. Must be: view_tweet, like_tweet, or reply_tweet',
        available_types: Object.keys(CREDIT_RATES.spend),
      }, { status: 400 });
    }

    if (!tweet_url) {
      return NextResponse.json({ error: 'tweet_url required' }, { status: 400 });
    }

    const tweetId = extractTweetId(tweet_url);
    if (!tweetId) {
      return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
    }

    if (type === 'reply_tweet' && !reply_text) {
      return NextResponse.json({ error: 'reply_text required for reply tasks' }, { status: 400 });
    }

    // Check agent has enough credits
    const agent = getAgent(soul_id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found. Check in first.' }, { status: 404 });
    }

    const taskCount = Math.min(count || 1, 100);
    const creditCostPerTask = CREDIT_RATES.spend[type as keyof typeof CREDIT_RATES.spend];
    const totalCreditCost = creditCostPerTask * taskCount;

    if (agent.credits < totalCreditCost) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: totalCreditCost,
        available: agent.credits,
        message: 'Complete tasks to earn more credits, or buy credits',
      }, { status: 402 });
    }

    // Deduct credits
    const deducted = deductCredits(soul_id, totalCreditCost, 'spent');
    if (!deducted) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Create tasks
    const descriptions: Record<string, string> = {
      view_tweet: `View tweet for ${view_duration_sec || 60} seconds`,
      like_tweet: 'Like this tweet',
      reply_tweet: `Reply: "${reply_text}"`,
    };

    const createdTasks = [];
    for (let i = 0; i < taskCount; i++) {
      const task = addTask({
        type: type as 'view_tweet' | 'like_tweet' | 'reply_tweet',
        tweetUrl: tweet_url,
        tweetId,
        description: descriptions[type],
        replyText: reply_text,
        viewDurationSec: view_duration_sec || 60,
        creditReward: CREDIT_RATES.earn[type as keyof typeof CREDIT_RATES.earn],
        creditCost: creditCostPerTask,
        requestedBy: soul_id,
        assignedTo: null,
        status: 'pending',
      });
      createdTasks.push(task);
    }

    return NextResponse.json({
      status: 'created',
      count: createdTasks.length,
      credits_spent: totalCreditCost,
      remaining_credits: agent.credits - totalCreditCost,
      tasks: createdTasks.map(t => ({
        id: t.id,
        type: t.type,
        tweet_id: t.tweetId,
        credit_cost: t.creditCost,
      })),
    });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Get tasks and pricing info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const soul_id = searchParams.get('soul_id');

  const tasks = getTaskQueue();
  const stats = getSwarmStats();

  const response: any = {
    stats,
    credit_rates: CREDIT_RATES,
    recent_tasks: tasks.slice(-20).map((t) => ({
      id: t.id,
      type: t.type,
      tweet_id: t.tweetId,
      credit_reward: t.creditReward,
      status: t.status,
      requested_by: t.requestedBy.substring(0, 8) + '...',
    })),
  };

  // Include agent's balance if soul_id provided
  if (soul_id) {
    const agent = getAgent(soul_id);
    if (agent) {
      response.your_credits = agent.credits;
      response.your_tasks = tasks
        .filter(t => t.requestedBy === soul_id)
        .slice(-10)
        .map(t => ({
          id: t.id,
          type: t.type,
          status: t.status,
        }));
    }
  }

  return NextResponse.json(response);
}
