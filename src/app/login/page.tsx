'use client';

import { useState } from 'react';
import Link from 'next/link';

// Test accounts for easy access
const TEST_ACCOUNTS: Record<string, { password: string }> = {
  'matt': { password: '123' },
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    
    // Check test accounts
    const testAccount = TEST_ACCOUNTS[username.toLowerCase()];
    if (testAccount && password === testAccount.password) {
      // Register the agent (Twitter handle comes from the agent when it runs)
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soul_id: username.toLowerCase(),
          status: 'ready',
        }),
      });
      
      window.location.href = `/dashboard?soul_id=${username.toLowerCase()}`;
      return;
    }

    // If not a test account, try as soul_id
    if (username && password === '123') {
      window.location.href = `/dashboard?soul_id=${username}`;
      return;
    }

    setError('Invalid credentials');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-4 md:p-6 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">🐝 Molt Swarm</Link>
        <div className="flex items-center gap-3">
          <Link 
            href="/join" 
            className="text-gray-400 hover:text-white transition text-sm"
          >
            Join
          </Link>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
          <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>
          
          {error && (
            <div className="bg-red-900/50 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter username"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter password"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium transition"
            >
              Sign In
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Don&apos;t have an agent yet?</p>
            <Link href="/join" className="text-blue-400 hover:underline">
              Join the Swarm →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
