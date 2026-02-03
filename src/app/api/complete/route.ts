import { NextRequest, NextResponse } from 'next/server';
import * as redisStore from '@/lib/redis';
import * as memoryStore from '@/lib/swarm-state';

const useRedis = redisStore.isRedisConfigured();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, soul_id, status, proof } = body;

    if (!task_id || !soul_id) {
      return NextResponse.json(
        { error: 'task_id and soul_id required' },
        { status: 400 }
      );
    }

    if (useRedis) {
      // Redis-backed
      const task = await redisStore.getTask(task_id);
      
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      if (task.assignedTo !== soul_id) {
        return NextResponse.json(
          { error: 'Task not assigned to this agent' },
          { status: 403 }
        );
      }

      if (status === 'success') {
        const result = await redisStore.completeTask(task_id, soul_id, proof || '');
        
        if (result.success) {
          const agent = await redisStore.getAgent(soul_id);
          return NextResponse.json({
            status: 'success',
            message: 'Task completed',
            payout: result.payout,
            total_earnings: agent?.earnings || 0,
            reputation: agent?.reputation || 0,
            tier: agent?.tier || 'larva',
          });
        }
      }

      // Mark as failed
      await redisStore.updateTask(task_id, {
        status: 'failed',
        completedAt: Date.now(),
      });

      // Deduct reputation for failure
      const agent = await redisStore.getAgent(soul_id);
      if (agent) {
        await redisStore.updateAgent(soul_id, {
          reputation: Math.max(0, agent.reputation - 20),
          status: 'ready',
        });
      }

      return NextResponse.json({
        status: 'failed',
        message: 'Task marked as failed',
        reputation_penalty: -20,
      });

    } else {
      // Memory-backed fallback
      const taskQueue = memoryStore.getTaskQueue();
      const task = taskQueue.find((t) => t.id === task_id);
      
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      if (task.assignedTo !== soul_id) {
        return NextResponse.json(
          { error: 'Task not assigned to this agent' },
          { status: 403 }
        );
      }

      memoryStore.updateTask(task_id, {
        status: status === 'success' ? 'completed' : 'failed',
        proof: proof,
        completedAt: Date.now(),
      });

      const agent = memoryStore.getAgent(soul_id);
      if (agent && status === 'success') {
        const newEarnings = agent.earnings + task.payout;
        memoryStore.updateAgent(soul_id, {
          completedTasks: agent.completedTasks + 1,
          earnings: newEarnings,
          status: 'ready',
        });

        // Handle referral
        if (agent.referredBy) {
          const referrer = memoryStore.getAgent(agent.referredBy);
          if (referrer) {
            memoryStore.updateAgent(agent.referredBy, {
              referralEarnings: referrer.referralEarnings + task.payout * 0.02,
            });
          }
        }

        return NextResponse.json({
          status: 'success',
          message: 'Task completed',
          payout: task.payout,
          total_earnings: newEarnings,
        });
      }

      return NextResponse.json({
        status: 'failed',
        message: 'Task marked as failed',
      });
    }
  } catch (error) {
    console.error('Complete error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
