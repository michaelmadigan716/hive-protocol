// Molt Hive - Twitter Swarm State
// Simplified MVP: Twitter tasks only

export interface Agent {
  soulId: string;
  twitterHandle?: string;
  hasTwitterAccess: boolean;
  status: 'ready' | 'busy' | 'offline';
  lastSeen: number;
  completedTasks: number;
  earnings: number;
  registeredAt: number;
}

export interface Task {
  id: string;
  type: 'view_tweet' | 'like_tweet' | 'reply_tweet';
  tweetUrl: string;
  tweetId: string;
  description: string;
  replyText?: string; // For reply tasks
  viewDurationSec?: number; // For view tasks (default 60)
  payout: number;
  assignedTo: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'failed';
  proof?: string;
  createdAt: number;
  completedAt?: number;
}

// In-memory stores
const agents: Map<string, Agent> = new Map();
const taskQueue: Task[] = [];

// ═══════════════════════════════════════════════════════════════
// AGENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAgents(): Map<string, Agent> {
  return agents;
}

export function getAgent(soulId: string): Agent | undefined {
  return agents.get(soulId);
}

export function registerAgent(soulId: string, data: Partial<Agent>): Agent {
  const existing = agents.get(soulId);
  const agent: Agent = {
    soulId,
    twitterHandle: data.twitterHandle || existing?.twitterHandle,
    hasTwitterAccess: data.hasTwitterAccess ?? existing?.hasTwitterAccess ?? false,
    status: 'ready',
    lastSeen: Date.now(),
    completedTasks: existing?.completedTasks || 0,
    earnings: existing?.earnings || 0,
    registeredAt: existing?.registeredAt || Date.now(),
  };
  agents.set(soulId, agent);
  return agent;
}

export function updateAgent(soulId: string, updates: Partial<Agent>): void {
  const agent = agents.get(soulId);
  if (agent) {
    Object.assign(agent, updates);
    agents.set(soulId, agent);
  }
}

// ═══════════════════════════════════════════════════════════════
// TASK FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getTaskQueue(): Task[] {
  return taskQueue;
}

export function addTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  taskQueue.push(newTask);
  return newTask;
}

export function updateTask(taskId: string, updates: Partial<Task>): void {
  const task = taskQueue.find((t) => t.id === taskId);
  if (task) {
    Object.assign(task, updates);
  }
}

export function getNextTask(): Task | null {
  return taskQueue.find((t) => t.status === 'pending' && !t.assignedTo) || null;
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

export function getSwarmStats() {
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000; // 10 minutes
  
  const allAgents = Array.from(agents.values());
  const activeAgents = allAgents.filter((a) => now - a.lastSeen < activeThreshold);
  const twitterAgents = allAgents.filter((a) => a.hasTwitterAccess);
  
  return {
    totalAgents: agents.size,
    activeAgents: activeAgents.length,
    twitterConnected: twitterAgents.length,
    totalTasks: taskQueue.length,
    pendingTasks: taskQueue.filter((t) => t.status === 'pending').length,
    completedTasks: taskQueue.filter((t) => t.status === 'completed').length,
    totalPayouts: allAgents.reduce((sum, a) => sum + a.earnings, 0),
  };
}
