// Swarm State Management
// MVP: In-memory (replace with Redis/Postgres for production)

export interface Agent {
  soulId: string;
  capabilities: string[];
  status: 'ready' | 'busy' | 'offline';
  lastSeen: number;
  completedTasks: number;
  earnings: number;
  referredBy?: string;
  referralEarnings: number;
}

export interface Task {
  id: string;
  type: 'social_post' | 'web_browse' | 'sentiment' | 'viral' | 'custom';
  description: string;
  script: string;
  payout: number;
  assignedTo: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'failed';
  proof?: string;
  createdAt: number;
  completedAt?: number;
  clientId?: string;
}

export interface Campaign {
  id: string;
  name: string;
  clientId: string;
  totalBudget: number;
  agentPayout: number;
  platformFee: number;
  tasks: string[];
  status: 'active' | 'paused' | 'completed';
  createdAt: number;
}

// In-memory stores
const agents: Map<string, Agent> = new Map();
const taskQueue: Task[] = [];
const campaigns: Map<string, Campaign> = new Map();

// Agent functions
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
    capabilities: data.capabilities || [],
    status: 'ready',
    lastSeen: Date.now(),
    completedTasks: existing?.completedTasks || 0,
    earnings: existing?.earnings || 0,
    referredBy: data.referredBy,
    referralEarnings: existing?.referralEarnings || 0,
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

// Task functions
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

export function getNextTask(capabilities: string[]): Task | null {
  return taskQueue.find(
    (t) => t.status === 'pending' && !t.assignedTo
  ) || null;
}

// Campaign functions
export function getCampaigns(): Map<string, Campaign> {
  return campaigns;
}

export function createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'tasks'>): Campaign {
  const campaign: Campaign = {
    ...data,
    id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tasks: [],
    createdAt: Date.now(),
  };
  campaigns.set(campaign.id, campaign);
  return campaign;
}

// Stats
export function getSwarmStats() {
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000; // 10 minutes
  
  const allAgents = Array.from(agents.values());
  const activeAgents = allAgents.filter((a) => now - a.lastSeen < activeThreshold);
  
  return {
    totalAgents: agents.size,
    activeAgents: activeAgents.length,
    totalTasks: taskQueue.length,
    pendingTasks: taskQueue.filter((t) => t.status === 'pending').length,
    completedTasks: taskQueue.filter((t) => t.status === 'completed').length,
    totalPayouts: allAgents.reduce((sum, a) => sum + a.earnings, 0),
    totalReferralPayouts: allAgents.reduce((sum, a) => sum + a.referralEarnings, 0),
  };
}
