import { NextRequest, NextResponse } from 'next/server';
import { addTask, getTaskQueue, getSwarmStats } from '@/lib/swarm-state';

// Create new task (for clients/admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, description, script, payout, api_key } = body;

    // Simple API key check (replace with proper auth)
    const validKey = process.env.HIVE_ADMIN_KEY || 'hive_admin_key';
    if (api_key !== validKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (!type || !description || !payout) {
      return NextResponse.json(
        { error: 'type, description, and payout required' },
        { status: 400 }
      );
    }

    const task = addTask({
      type,
      description,
      script: script || '',
      payout: parseFloat(payout),
      assignedTo: null,
      status: 'pending',
    });

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
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Get all tasks (admin)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const api_key = searchParams.get('api_key');

  // Simple API key check
  const validKey = process.env.HIVE_ADMIN_KEY || 'hive_admin_key';
  if (api_key !== validKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  let tasks = getTaskQueue();

  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  const stats = getSwarmStats();

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
