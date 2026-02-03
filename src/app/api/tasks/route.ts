import { NextRequest, NextResponse } from 'next/server';
import * as redisStore from '@/lib/redis';
import * as memoryStore from '@/lib/swarm-state';

const useRedis = redisStore.isRedisConfigured();

// Validate admin API key
function validateApiKey(key: string | null): boolean {
  const validKey = process.env.HIVE_ADMIN_KEY || 'hive_admin_key';
  return key === validKey;
}

// Create new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, description, script, payout, api_key, campaign_id, verification_method } = body;

    if (!validateApiKey(api_key)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (!type || !description || !payout) {
      return NextResponse.json(
        { error: 'type, description, and payout required' },
        { status: 400 }
      );
    }

    const taskData = {
      type,
      description,
      script: script || '',
      payout: parseFloat(payout),
      assignedTo: null,
      status: 'pending' as const,
      campaignId: campaign_id,
      verificationMethod: (verification_method || 'auto') as 'auto' | 'screenshot' | 'api' | 'manual',
    };

    if (useRedis) {
      const task = await redisStore.addTask(taskData);
      return NextResponse.json({
        status: 'created',
        task: {
          id: task.id,
          type: task.type,
          description: task.description,
          payout: task.payout,
          status: task.status,
        },
      });
    } else {
      const task = memoryStore.addTask(taskData);
      return NextResponse.json({
        status: 'created',
        task: {
          id: task.id,
          type: task.type,
          description: task.description,
          payout: task.payout,
          status: task.status,
        },
      });
    }
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Get all tasks (admin)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const api_key = searchParams.get('api_key');

  if (!validateApiKey(api_key)) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  if (useRedis) {
    const stats = await redisStore.getSwarmStats();
    // For now, just return stats since we'd need to iterate all tasks
    return NextResponse.json({
      tasks: [],
      stats,
      note: 'Task listing requires pagination - use stats for overview',
    });
  } else {
    const tasks = memoryStore.getTaskQueue();
    const stats = memoryStore.getSwarmStats();
    
    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        type: t.type,
        description: t.description,
        payout: t.payout,
        status: t.status,
        assignedTo: t.assignedTo,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      stats,
    });
  }
}

// Bulk create tasks (for campaigns)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tasks, api_key, campaign_id } = body;

    if (!validateApiKey(api_key)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'tasks array required' }, { status: 400 });
    }

    const createdTasks = [];

    for (const taskData of tasks) {
      const task = {
        type: taskData.type,
        description: taskData.description,
        script: taskData.script || '',
        payout: parseFloat(taskData.payout),
        assignedTo: null,
        status: 'pending' as const,
        campaignId: campaign_id,
        verificationMethod: (taskData.verification_method || 'auto') as 'auto' | 'screenshot' | 'api' | 'manual',
      };

      if (useRedis) {
        const created = await redisStore.addTask(task);
        createdTasks.push(created);
      } else {
        const created = memoryStore.addTask(task);
        createdTasks.push(created);
      }
    }

    return NextResponse.json({
      status: 'created',
      count: createdTasks.length,
      tasks: createdTasks.map(t => ({ id: t.id, type: t.type })),
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
