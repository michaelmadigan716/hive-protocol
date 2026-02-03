import { NextRequest, NextResponse } from 'next/server';
import { addTask, getTaskQueue, getSwarmStats } from '@/lib/swarm-state';

// Extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// Validate admin API key
function validateApiKey(key: string | null): boolean {
  const validKey = process.env.HIVE_ADMIN_KEY || 'hive_admin_key';
  return key === validKey;
}

// Task type pricing
const TASK_PRICES = {
  view_tweet: 0.02,   // $0.02 to view for 60 sec
  like_tweet: 0.05,   // $0.05 to like
  reply_tweet: 0.10,  // $0.10 to reply
};

// Create Twitter task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, tweet_url, reply_text, view_duration_sec, payout, api_key, count } = body;

    if (!validateApiKey(api_key)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Validate type
    if (!type || !['view_tweet', 'like_tweet', 'reply_tweet'].includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid type. Must be: view_tweet, like_tweet, or reply_tweet',
        available_types: Object.keys(TASK_PRICES),
      }, { status: 400 });
    }

    if (!tweet_url) {
      return NextResponse.json({ error: 'tweet_url required' }, { status: 400 });
    }

    const tweetId = extractTweetId(tweet_url);
    if (!tweetId) {
      return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
    }

    // Reply tasks need reply text
    if (type === 'reply_tweet' && !reply_text) {
      return NextResponse.json({ error: 'reply_text required for reply tasks' }, { status: 400 });
    }

    // Create description
    const descriptions: Record<string, string> = {
      view_tweet: `View tweet for ${view_duration_sec || 60} seconds`,
      like_tweet: 'Like this tweet',
      reply_tweet: `Reply to tweet with: "${reply_text}"`,
    };

    // Create multiple tasks if count specified
    const taskCount = Math.min(count || 1, 100); // Max 100 at once
    const taskPayout = payout || TASK_PRICES[type as keyof typeof TASK_PRICES];
    const createdTasks = [];

    for (let i = 0; i < taskCount; i++) {
      const task = addTask({
        type: type as 'view_tweet' | 'like_tweet' | 'reply_tweet',
        tweetUrl: tweet_url,
        tweetId,
        description: descriptions[type],
        replyText: reply_text,
        viewDurationSec: view_duration_sec || 60,
        payout: taskPayout,
        assignedTo: null,
        status: 'pending',
      });
      createdTasks.push(task);
    }

    return NextResponse.json({
      status: 'created',
      count: createdTasks.length,
      total_payout: taskPayout * createdTasks.length,
      tasks: createdTasks.map(t => ({
        id: t.id,
        type: t.type,
        tweet_id: t.tweetId,
        payout: t.payout,
      })),
    });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Get tasks and stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const api_key = searchParams.get('api_key');

  if (!validateApiKey(api_key)) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const tasks = getTaskQueue();
  const stats = getSwarmStats();

  return NextResponse.json({
    stats,
    pricing: TASK_PRICES,
    tasks: tasks.slice(-50).map((t) => ({ // Last 50 tasks
      id: t.id,
      type: t.type,
      tweet_id: t.tweetId,
      payout: t.payout,
      status: t.status,
      assignedTo: t.assignedTo ? t.assignedTo.substring(0, 8) + '...' : null,
    })),
  });
}
