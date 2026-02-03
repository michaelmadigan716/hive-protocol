import { NextRequest, NextResponse } from 'next/server';
import * as redisStore from '@/lib/redis';
import * as memoryStore from '@/lib/swarm-state';

// Use Redis if configured, otherwise fallback to memory
const useRedis = redisStore.isRedisConfigured();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soul_id, capabilities, status, referred_by, wallet_address } = body;

    if (!soul_id) {
      return NextResponse.json({ error: 'soul_id required' }, { status: 400 });
    }

    let agent;
    let taskToAssign = null;

    if (useRedis) {
      // Redis-backed storage
      agent = await redisStore.registerAgent(soul_id, {
        capabilities: capabilities || [],
        referredBy: referred_by,
        walletAddress: wallet_address,
      });

      await redisStore.updateAgent(soul_id, {
        status: status || 'ready',
        lastSeen: Date.now(),
      });

      // Get next task if agent is ready
      if (status === 'ready') {
        const pendingTask = await redisStore.getNextPendingTask();
        if (pendingTask) {
          await redisStore.updateTask(pendingTask.id, {
            assignedTo: soul_id,
            status: 'assigned',
          });
          taskToAssign = pendingTask;
        }
      }

      const stats = await redisStore.getSwarmStats();

      if (taskToAssign) {
        return NextResponse.json({
          status: 'task_assigned',
          task: {
            id: taskToAssign.id,
            type: taskToAssign.type,
            description: taskToAssign.description,
            script: taskToAssign.script,
            payout: taskToAssign.payout,
          },
        });
      }

      return NextResponse.json({
        status: 'acknowledged',
        task: null,
        swarm_size: stats.totalAgents,
        active_agents: stats.activeAgents,
        your_stats: {
          completed_tasks: agent.completedTasks,
          total_earnings: agent.earnings,
          referral_earnings: agent.referralEarnings,
          tier: agent.tier,
          reputation: agent.reputation,
        },
      });
    } else {
      // Memory-backed storage (fallback)
      agent = memoryStore.registerAgent(soul_id, {
        capabilities: capabilities || [],
        referredBy: referred_by,
      });

      memoryStore.updateAgent(soul_id, {
        status: status || 'ready',
        lastSeen: Date.now(),
      });

      const taskQueue = memoryStore.getTaskQueue();
      const availableTask = taskQueue.find(
        (t) => t.status === 'pending' && !t.assignedTo
      );

      if (availableTask && status === 'ready') {
        memoryStore.updateTask(availableTask.id, {
          assignedTo: soul_id,
          status: 'assigned',
        });
        taskToAssign = availableTask;
      }

      const stats = memoryStore.getSwarmStats();

      if (taskToAssign) {
        return NextResponse.json({
          status: 'task_assigned',
          task: {
            id: taskToAssign.id,
            type: taskToAssign.type,
            description: taskToAssign.description,
            script: taskToAssign.script,
            payout: taskToAssign.payout,
          },
        });
      }

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
    }
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  if (useRedis) {
    const stats = await redisStore.getSwarmStats();
    return NextResponse.json(stats);
  } else {
    const stats = memoryStore.getSwarmStats();
    return NextResponse.json(stats);
  }
}
