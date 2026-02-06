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

interface StatsConfig {
  enabled: boolean;
  agentMultiplier: number;
  activeMultiplier: number;
  tasksMultiplier: number;
  creditsMultiplier: number;
  baseAgents: number;
  baseActive: number;
  baseTasks: number;
}

interface RealStats {
  totalAgents: number;
  activeAgents: number;
  twitterConnected: number;
  completedTasks: number;
  totalCreditsInCirculation: number;
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<SwarmStats | null>(null);
  
  // Stats inflation state
  const [statsConfig, setStatsConfig] = useState<StatsConfig | null>(null);
  const [realStats, setRealStats] = useState<RealStats | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const authenticate = async () => {
    // Verify against server
    try {
      const res = await fetch('/api/admin/stats-config', {
        headers: { 'x-admin-key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true);
        setStatsConfig(data.config);
        setRealStats(data.realStats);
        fetchStats();
      } else {
        alert('Invalid key');
      }
    } catch {
      alert('Authentication failed');
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

  const saveStatsConfig = async () => {
    if (!statsConfig) return;
    setConfigSaving(true);
    try {
      const res = await fetch('/api/admin/stats-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': apiKey,
        },
        body: JSON.stringify(statsConfig),
      });
      if (res.ok) {
        const data = await res.json();
        setStatsConfig(data.config);
        setRealStats(data.realStats);
        alert('Config saved!');
      } else {
        alert('Failed to save config');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Save failed');
    } finally {
      setConfigSaving(false);
    }
  };

  const updateConfig = (key: keyof StatsConfig, value: number | boolean) => {
    if (statsConfig) {
      setStatsConfig({ ...statsConfig, [key]: value });
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
        <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats?.totalAgents || 0}</div>
            <div className="text-gray-400 text-sm">Total Agents</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats?.twitterConnected || 0}</div>
            <div className="text-gray-400 text-sm">Twitter Connected</div>
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

        {/* Stats Boost Controls */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🎭 Public Stats Boost</h2>
          
          <div className="space-y-6">
            {/* Real vs Display Stats */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-700/50 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">📊 Real Stats</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Agents:</span>
                    <span className="text-white font-mono">{realStats?.totalAgents || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Twitter:</span>
                    <span className="text-white font-mono">{realStats?.twitterConnected || 0}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">🌐 Public Display</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Agents:</span>
                    <span className="text-purple-400 font-mono">
                      {statsConfig?.enabled 
                        ? (realStats?.totalAgents || 0) + (statsConfig?.baseAgents || 0)
                        : realStats?.totalAgents || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Twitter:</span>
                    <span className="text-purple-400 font-mono">
                      {statsConfig?.enabled 
                        ? (realStats?.twitterConnected || 0) + (statsConfig?.baseAgents || 0)
                        : realStats?.twitterConnected || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enable Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateConfig('enabled', !statsConfig?.enabled)}
                className={`relative w-12 h-6 rounded-full transition ${
                  statsConfig?.enabled ? 'bg-purple-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  statsConfig?.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
              <span className={statsConfig?.enabled ? 'text-purple-400' : 'text-gray-400'}>
                {statsConfig?.enabled ? 'Boost Enabled' : 'Boost Disabled'}
              </span>
            </div>

            {/* Base Agents (also applies to Twitter Connected) */}
            <div className="max-w-xs">
              <label className="block text-gray-400 text-sm mb-2">Add to Agents & Twitter Connected</label>
              <input
                type="number"
                min="0"
                value={statsConfig?.baseAgents || 0}
                onChange={(e) => updateConfig('baseAgents', parseInt(e.target.value) || 0)}
                className="w-full bg-gray-700 rounded px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="0"
              />
              <p className="text-gray-500 text-xs mt-2">This number gets added to both Agents and Twitter Connected</p>
            </div>

            {/* Save Button */}
            <button
              onClick={saveStatsConfig}
              disabled={configSaving}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 py-3 rounded-lg font-medium transition"
            >
              {configSaving ? 'Saving...' : 'Save'}
            </button>
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
