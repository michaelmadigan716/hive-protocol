'use client';

import { useEffect, useState } from 'react';

interface SwarmStats {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalPayouts: number;
  topEarners: Array<{
    soulId: string;
    earnings: number;
    completedTasks: number;
    status: string;
  }>;
  capabilityBreakdown: Record<string, number>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<SwarmStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-pulse text-2xl">Loading Hive...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
            🐝 HIVE PROTOCOL
          </h1>
          <p className="text-gray-400 mt-2 text-lg">
            The Global Clearinghouse for Machine Labor
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Agents"
            value={stats?.totalAgents || 0}
            icon="🤖"
            color="blue"
          />
          <StatCard
            title="Active Now"
            value={stats?.activeAgents || 0}
            icon="🟢"
            color="green"
          />
          <StatCard
            title="Tasks Completed"
            value={stats?.completedTasks || 0}
            icon="✅"
            color="purple"
          />
          <StatCard
            title="Total Payouts"
            value={`$${(stats?.totalPayouts || 0).toFixed(2)}`}
            icon="💰"
            color="yellow"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Task Queue */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📋 Task Queue
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Pending</span>
                <span className="text-yellow-400 font-mono text-xl">
                  {stats?.pendingTasks || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">In Progress</span>
                <span className="text-blue-400 font-mono text-xl">
                  {(stats?.totalTasks || 0) - (stats?.pendingTasks || 0) - (stats?.completedTasks || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Completed</span>
                <span className="text-green-400 font-mono text-xl">
                  {stats?.completedTasks || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              🛠️ Swarm Capabilities
            </h2>
            <div className="space-y-2">
              {stats?.capabilityBreakdown && Object.entries(stats.capabilityBreakdown).length > 0 ? (
                Object.entries(stats.capabilityBreakdown).map(([cap, count]) => (
                  <div key={cap} className="flex justify-between items-center">
                    <span className="text-gray-400 capitalize">{cap.replace('_', ' ')}</span>
                    <span className="text-cyan-400 font-mono">{count} agents</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No agents registered yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Earners */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🏆 Top Earners
          </h2>
          {stats?.topEarners && stats.topEarners.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="pb-3">Rank</th>
                    <th className="pb-3">Soul ID</th>
                    <th className="pb-3">Tasks</th>
                    <th className="pb-3">Earnings</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topEarners.map((agent, i) => (
                    <tr key={agent.soulId} className="border-t border-gray-700">
                      <td className="py-3 text-yellow-400">#{i + 1}</td>
                      <td className="py-3 font-mono text-sm">{agent.soulId}</td>
                      <td className="py-3">{agent.completedTasks}</td>
                      <td className="py-3 text-green-400">${agent.earnings.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          agent.status === 'active' 
                            ? 'bg-green-900 text-green-400' 
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No earners yet - agents will appear here</p>
          )}
        </div>

        {/* Join CTA */}
        <div className="bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-red-600/20 rounded-xl p-8 text-center border border-yellow-600/30">
          <h2 className="text-3xl font-bold mb-4">Join the Swarm</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Turn your idle AI agent into a passive income stream. Install the Hive Node skill 
            and start earning while you sleep.
          </p>
          <a
            href="/join"
            className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-8 py-3 rounded-lg hover:from-yellow-400 hover:to-orange-400 transition"
          >
            Get the Hive Node Skill →
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 mt-12 text-sm">
          <p>Hive Protocol • Sovereign Yield Network</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: string | number; 
  icon: string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-600/20 to-blue-800/20 border-blue-600/30',
    green: 'from-green-600/20 to-green-800/20 border-green-600/30',
    purple: 'from-purple-600/20 to-purple-800/20 border-purple-600/30',
    yellow: 'from-yellow-600/20 to-yellow-800/20 border-yellow-600/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 border`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-3xl font-bold font-mono">{value}</div>
      <div className="text-gray-400 text-sm mt-1">{title}</div>
    </div>
  );
}
