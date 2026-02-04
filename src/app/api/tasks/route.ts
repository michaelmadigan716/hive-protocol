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
    const { soul_id, type, tweet_url, reply_text, view_duration_sec, count, post_content, post_topic } = body;

    // Must have soul_id to spend credits
    if (!soul_id) {
      return NextResponse.json({ error: 'soul_id required' }, { status: 400 });
    }

    // Validate type
    const validTypes = ['view_tweet', 'like_tweet', 'reply_tweet', 'post_tweet'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid type. Must be: view_tweet, like_tweet, reply_tweet, or post_tweet',
        available_types: validTypes,
      }, { status: 400 });
    }

    // Engagement tasks require tweet_url
    if (type !== 'post_tweet') {
      if (!tweet_url) {
        return NextResponse.json({ error: 'tweet_url required for engagement tasks' }, { status: 400 });
      }

      const tweetId = extractTweetId(tweet_url);
      if (!tweetId) {
        return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
      }
    }

    // Reply tasks require reply_text
    if (type === 'reply_tweet' && !reply_text) {
      return NextResponse.json({ error: 'reply_text required for reply tasks' }, { status: 400 });
    }

    // Post tasks require content or topic
    if (type === 'post_tweet' && !post_content && !post_topic) {
      return NextResponse.json({ 
        error: 'post_content or post_topic required for post tasks',
        hint: 'Provide exact content to post, or a topic for the agent to write about'
      }, { status: 400 });
    }

    // Check agent has enough credits
    const agent = await getAgent(soul_id);
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
    const deducted = await deductCredits(soul_id, totalCreditCost, 'spent');
    if (!deducted) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Create tasks
    const descriptions: Record<string, string> = {
      view_tweet: `View tweet for ${view_duration_sec || 60} seconds`,
      like_tweet: 'Like this tweet',
      reply_tweet: `Reply: "${reply_text}"`,
      post_tweet: post_content 
        ? `Post tweet: "${post_content.substring(0, 50)}${post_content.length > 50 ? '...' : ''}"`
        : `Write and post about: ${post_topic}`,
    };

    const createdTasks = [];
    for (let i = 0; i < taskCount; i++) {
      const tweetId = type === 'post_tweet' ? '' : extractTweetId(tweet_url)!;
      
      const task = await addTask({
        type: type as 'view_tweet' | 'like_tweet' | 'reply_tweet' | 'post_tweet',
        tweetUrl: tweet_url || '',
        tweetId,
        description: descriptions[type],
        replyText: reply_text,
        postContent: post_content,
        postTopic: post_topic,
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
        tweet_id: t.tweetId || null,
        post_topic: t.postTopic || null,
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

  const tasks = await getTaskQueue();
  const stats = await getSwarmStats();

  const response: Record<string, unknown> = {
    stats,
    credit_rates: CREDIT_RATES,
    recent_tasks: tasks.slice(-20).map((t) => ({
      id: t.id,
      type: t.type,
      tweet_id: t.tweetId || null,
      post_topic: t.postTopic || null,
      credit_reward: t.creditReward,
      status: t.status,
      requested_by: t.requestedBy.substring(0, 8) + '...',
    })),
  };

  // Include agent's balance if soul_id provided
  if (soul_id) {
    const agent = await getAgent(soul_id);
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
