'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SwarmStats {
  totalAgents: number;
  activeAgents: number;
  twitterConnected: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalCreditsInCirculation: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  topAgents: Array<{
    soulId: string;
    twitterHandle: string | null;
    credits: number;
    creditsEarned: number;
    completedTasks: number;
    status: string;
    twitterConnected: boolean;
  }>;
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<SwarmStats | null>(null);

  const authenticate = () => {
    if (apiKey === '123') {
      setAuthenticated(true);
      fetchStats();
    } else {
      alert('Invalid key');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    if (authenticated) {
      const interval = setInterval(fetchStats, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">🔐 Admin Access</h1>
          <input
            type="password"
            placeholder="Admin Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && authenticate()}
            className="w-full bg-gray-700 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={authenticate}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-400 transition"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-4 md:p-6 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">🐝 Molt Swarm</Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white transition text-sm">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-8">
        <h1 className="text-3xl font-bold mb-8">🔧 Admin Dashboard</h1>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats?.totalAgents || 0}</div>
            <div className="text-gray-400 text-sm">Total Agents</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats?.activeAgents || 0}</div>
            <div className="text-gray-400 text-sm">Active Now</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats?.twitterConnected || 0}</div>
            <div className="text-gray-400 text-sm">Twitter Connected</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats?.totalCreditsInCirculation || 0}</div>
            <div className="text-gray-400 text-sm">Credits Circulating</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Task Queue */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Task Queue</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Pending</span>
                <span className="text-yellow-400 font-mono text-xl">
                  {stats?.pendingTasks || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Completed</span>
                <span className="text-green-400 font-mono text-xl">
                  {stats?.completedTasks || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total</span>
                <span className="text-blue-400 font-mono text-xl">
                  {stats?.totalTasks || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Economy Stats */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">📊 Economy Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Earned</span>
                <span className="text-green-400 font-mono text-xl">
                  {stats?.totalCreditsEarned || 0} 🪙
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Spent</span>
                <span className="text-red-400 font-mono text-xl">
                  {stats?.totalCreditsSpent || 0} 🪙
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">In Circulation</span>
                <span className="text-yellow-400 font-mono text-xl">
                  {stats?.totalCreditsInCirculation || 0} 🪙
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Agents */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">🏆 All Agents</h2>
          {stats?.topAgents && stats.topAgents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="pb-3">#</th>
                    <th className="pb-3">Soul ID</th>
                    <th className="pb-3">Twitter</th>
                    <th className="pb-3">Tasks Done</th>
                    <th className="pb-3">Credits</th>
                    <th className="pb-3">Earned</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topAgents.map((agent, i) => (
                    <tr key={agent.soulId} className="border-t border-gray-700">
                      <td className="py-3 text-yellow-400">#{i + 1}</td>
                      <td className="py-3 font-mono text-sm">{agent.soulId}</td>
                      <td className="py-3">
                        {agent.twitterHandle ? (
                          <span className="text-blue-400">@{agent.twitterHandle}</span>
                        ) : agent.twitterConnected ? (
                          <span className="text-green-400">✓ Connected</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3">{agent.completedTasks}</td>
                      <td className="py-3 text-yellow-400">{agent.credits} 🪙</td>
                      <td className="py-3 text-green-400">{agent.creditsEarned} 🪙</td>
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
            <p className="text-gray-500">No agents yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
