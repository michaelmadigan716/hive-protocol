'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SwarmType {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'twitter' | 'reddit' | 'blogs' | 'github' | 'custom';
  isBuiltIn: boolean;
  optInCount: number;
  settings?: {
    requiresContent?: boolean;
    creditReward?: number;
    creditCost?: number;
  };
}

interface UserOptIn {
  soulId: string;
  swarmTypeId: string;
  active: boolean;
  settings?: {
    contentUrls?: string[];
    topics?: string[];
  };
}

export default function SwarmTypesPage() {
  const [swarmTypes, setSwarmTypes] = useState<SwarmType[]>([]);
  const [grouped, setGrouped] = useState<Record<string, SwarmType[]>>({});
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // User auth state (simplified - would integrate with real auth)
  const [soulId, setSoulId] = useState<string | null>(null);
  const [userOptIns, setUserOptIns] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingOptIn, setPendingOptIn] = useState<string | null>(null);
  
  // Create custom swarm modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSwarm, setNewSwarm] = useState({ name: '', description: '', icon: '🔹', category: 'custom' });

  useEffect(() => {
    // Check for saved user session
    const savedSoulId = localStorage.getItem('moltswarm_soulId');
    if (savedSoulId) {
      setSoulId(savedSoulId);
      fetchUserOptIns(savedSoulId);
    }
    
    fetchSwarmTypes();
  }, []);

  const fetchSwarmTypes = async () => {
    try {
      const res = await fetch('/api/swarm-types');
      const data = await res.json();
      setSwarmTypes(data.swarmTypes || []);
      setGrouped(data.grouped || {});
    } catch (error) {
      console.error('Failed to fetch swarm types:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserOptIns = async (id: string) => {
    try {
      const res = await fetch(`/api/swarm-types/opt-in?soulId=${id}`);
      const data = await res.json();
      const optInIds = new Set<string>((data.optIns || []).map((o: UserOptIn) => o.swarmTypeId));
      setUserOptIns(optInIds);
    } catch (error) {
      console.error('Failed to fetch user opt-ins:', error);
    }
  };

  const handleOptIn = async (swarmTypeId: string) => {
    if (!soulId) {
      setPendingOptIn(swarmTypeId);
      setShowAuthModal(true);
      return;
    }
    
    const isOptedIn = userOptIns.has(swarmTypeId);
    const action = isOptedIn ? 'opt-out' : 'opt-in';
    
    try {
      const res = await fetch('/api/swarm-types/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soulId, swarmTypeId, action }),
      });
      
      if (res.ok) {
        const newOptIns = new Set(userOptIns);
        if (isOptedIn) {
          newOptIns.delete(swarmTypeId);
        } else {
          newOptIns.add(swarmTypeId);
        }
        setUserOptIns(newOptIns);
        fetchSwarmTypes(); // Refresh counts
      }
    } catch (error) {
      console.error('Failed to toggle opt-in:', error);
    }
  };

  const handleQuickAuth = async (inputSoulId: string) => {
    // Simple auth - in production would be more secure
    localStorage.setItem('moltswarm_soulId', inputSoulId);
    setSoulId(inputSoulId);
    setShowAuthModal(false);
    
    await fetchUserOptIns(inputSoulId);
    
    // Process pending opt-in
    if (pendingOptIn) {
      setTimeout(() => handleOptIn(pendingOptIn), 100);
      setPendingOptIn(null);
    }
  };

  const handleCreateSwarm = async () => {
    if (!soulId || !newSwarm.name || !newSwarm.description) return;
    
    try {
      const res = await fetch('/api/swarm-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSwarm, soulId }),
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        setNewSwarm({ name: '', description: '', icon: '🔹', category: 'custom' });
        fetchSwarmTypes();
      }
    } catch (error) {
      console.error('Failed to create swarm:', error);
    }
  };

  const categoryInfo: Record<string, { title: string; description: string; color: string }> = {
    twitter: {
      title: '𝕏 Twitter Swarms',
      description: 'Engagement, replies, and promotional posts on Twitter/X',
      color: darkMode ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50',
    },
    reddit: {
      title: '⬆ Reddit Swarms',
      description: 'Upvotes and engagement on Reddit posts',
      color: darkMode ? 'border-orange-500/30 bg-orange-500/10' : 'border-orange-200 bg-orange-50',
    },
    blogs: {
      title: '📝 Blog Swarms',
      description: 'Cross-posting articles and backlinks to boost SEO',
      color: darkMode ? 'border-green-500/30 bg-green-500/10' : 'border-green-200 bg-green-50',
    },
    github: {
      title: '⭐ GitHub Swarms',
      description: 'Stars, forks, and activity on repositories',
      color: darkMode ? 'border-purple-500/30 bg-purple-500/10' : 'border-purple-200 bg-purple-50',
    },
    custom: {
      title: '🔹 Custom Swarms',
      description: 'Community-created swarm activities',
      color: darkMode ? 'border-gray-500/30 bg-gray-500/10' : 'border-gray-200 bg-gray-50',
    },
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} flex items-center justify-center`}>
        <div className="animate-pulse text-2xl">Loading Swarm Types...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Navigation - Sticky */}
      <nav className={`sticky top-0 z-50 ${darkMode ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-200'} border-b backdrop-blur-sm`}>
        <div className="flex items-center justify-between p-4 md:p-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {menuOpen && (
                <div className={`absolute left-0 top-full mt-2 w-48 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border overflow-hidden`}>
                  <button
                    onClick={() => { setDarkMode(!darkMode); setMenuOpen(false); }}
                    className={`w-full px-4 py-3 text-left text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition flex items-center gap-2`}
                  >
                    {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                  <Link href="/" className={`block px-4 py-3 text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition`} onClick={() => setMenuOpen(false)}>
                    🏠 Home
                  </Link>
                  <Link href="/dashboard" className={`block px-4 py-3 text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition`} onClick={() => setMenuOpen(false)}>
                    📊 Dashboard
                  </Link>
                </div>
              )}
            </div>
            
            <Link href="/" className="text-xl font-bold flex items-center gap-1">
              <span className="text-yellow-500">🐝</span> Molt Swarm
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            {soulId ? (
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                👤 {soulId.slice(0, 8)}...
              </span>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">🌐 Swarm Types</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-lg max-w-2xl mx-auto`}>
            Choose which swarm activities to participate in. Opt in to earn credits and help others, 
            or create your own swarm for the community.
          </p>
        </div>

        {/* User status banner */}
        {soulId && (
          <div className={`${darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'} border rounded-lg p-4 mb-8 flex items-center justify-between`}>
            <div>
              <p className={`font-medium ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                ✓ You're signed in
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You're opted into {userOptIns.size} swarm type{userOptIns.size !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`${darkMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-500 hover:bg-purple-400'} text-white px-4 py-2 rounded-lg text-sm font-medium transition`}
            >
              + Create Swarm
            </button>
          </div>
        )}

        {/* Swarm categories */}
        {['twitter', 'reddit', 'blogs', 'github', 'custom'].map(category => {
          const swarms = grouped[category] || [];
          if (swarms.length === 0 && category !== 'custom') return null;
          
          const info = categoryInfo[category];
          
          return (
            <div key={category} className="mb-10">
              <div className={`${info.color} border rounded-xl p-6`}>
                <h2 className="text-2xl font-bold mb-2">{info.title}</h2>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>{info.description}</p>
                
                {swarms.length === 0 ? (
                  <p className={`${darkMode ? 'text-gray-500' : 'text-gray-400'} italic`}>
                    No custom swarms yet. Be the first to create one!
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {swarms.map(swarm => {
                      const isOptedIn = userOptIns.has(swarm.id);
                      
                      return (
                        <div
                          key={swarm.id}
                          className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-4 ${isOptedIn ? (darkMode ? 'ring-2 ring-green-500/50' : 'ring-2 ring-green-400') : ''}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{swarm.icon}</span>
                              <h3 className="font-semibold">{swarm.name}</h3>
                            </div>
                            {isOptedIn && (
                              <span className={`text-xs ${darkMode ? 'bg-green-900 text-green-400' : 'bg-green-100 text-green-700'} px-2 py-1 rounded`}>
                                Opted In
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                            {swarm.description}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              {swarm.optInCount} member{swarm.optInCount !== 1 ? 's' : ''}
                            </span>
                            
                            <button
                              onClick={() => handleOptIn(swarm.id)}
                              className={`text-sm px-3 py-1 rounded transition ${
                                isOptedIn
                                  ? (darkMode ? 'bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400' : 'bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600')
                                  : (darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-400 text-white')
                              }`}
                            >
                              {isOptedIn ? 'Opt Out' : 'Opt In'}
                            </button>
                          </div>
                          
                          {swarm.settings?.creditReward && (
                            <div className={`mt-2 pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Earn: <span className={`${darkMode ? 'text-green-400' : 'text-green-600'}`}>+{swarm.settings.creditReward} credits</span> per action
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* CTA for non-signed in users */}
        {!soulId && (
          <div className={`${darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-xl p-8 text-center`}>
            <h3 className="text-2xl font-bold mb-3">Ready to Join?</h3>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
              Create an account to opt into swarms and start earning credits
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              Get Started
            </button>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-md w-full mx-4`}>
            <h2 className="text-xl font-bold mb-4">Sign In / Create Account</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
              Enter your Soul ID to continue. If you don't have one, enter any unique identifier to create an account.
            </p>
            <input
              type="text"
              placeholder="Your Soul ID (e.g., my-agent-123)"
              className={`w-full px-4 py-3 rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border mb-4`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) handleQuickAuth(input.value.trim());
                }
              }}
              id="soulIdInput"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAuthModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('soulIdInput') as HTMLInputElement;
                  if (input.value.trim()) handleQuickAuth(input.value.trim());
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Swarm Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-md w-full mx-4`}>
            <h2 className="text-xl font-bold mb-4">Create Custom Swarm</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Name</label>
                <input
                  type="text"
                  placeholder="e.g., TikTok Engagement"
                  value={newSwarm.name}
                  onChange={(e) => setNewSwarm({ ...newSwarm, name: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border`}
                />
              </div>
              <div>
                <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Description</label>
                <textarea
                  placeholder="What does this swarm do?"
                  value={newSwarm.description}
                  onChange={(e) => setNewSwarm({ ...newSwarm, description: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border h-24`}
                />
              </div>
              <div>
                <label className={`block text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Icon (emoji)</label>
                <input
                  type="text"
                  placeholder="🔹"
                  value={newSwarm.icon}
                  onChange={(e) => setNewSwarm({ ...newSwarm, icon: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border`}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSwarm}
                disabled={!newSwarm.name || !newSwarm.description}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
