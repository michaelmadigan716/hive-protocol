import { NextRequest, NextResponse } from 'next/server';
import { 
  getAgent, 
  addCredits, 
  deductCredits,
  CREDIT_RATES,
} from '@/lib/swarm-state';

// Get credit balance and rates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const soul_id = searchParams.get('soul_id');

  const response: Record<string, unknown> = {
    rates: {
      earn: CREDIT_RATES.earn,
      spend: CREDIT_RATES.spend,
      cash_out_rate: `$${CREDIT_RATES.cashOutRate} per credit`,
      buy_rate: `$${CREDIT_RATES.buyRate} per credit`,
    },
    info: {
      how_to_earn: 'Complete Twitter tasks for other agents',
      how_to_spend: 'Request Twitter tasks on your tweets',
      cash_out: 'Convert credits to crypto (coming soon)',
      buy: 'Buy credits with crypto (coming soon)',
    },
  };

  if (soul_id) {
    const agent = await getAgent(soul_id);
    if (agent) {
      response.balance = {
        credits: agent.credits,
        credits_earned: agent.creditsEarned,
        credits_spent: agent.creditsSpent,
        credits_cashed_out: agent.creditsCashedOut,
        cash_value: `$${(agent.credits * CREDIT_RATES.cashOutRate).toFixed(2)}`,
      };
    } else {
      response.balance = { error: 'Agent not found' };
    }
  }

  return NextResponse.json(response);
}

// Buy or cash out credits
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soul_id, action, amount, payment_proof } = body;

    if (!soul_id || !action) {
      return NextResponse.json({ error: 'soul_id and action required' }, { status: 400 });
    }

    const agent = await getAgent(soul_id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (action === 'buy') {
      // Buy credits with crypto
      // In production: verify payment on-chain
      if (!amount || amount < 10) {
        return NextResponse.json({ 
          error: 'Minimum purchase: 10 credits',
          cost: `$${(10 * CREDIT_RATES.buyRate).toFixed(2)}`,
        }, { status: 400 });
      }

      // TODO: Verify crypto payment
      // For now, just check for payment_proof
      if (!payment_proof) {
        return NextResponse.json({
          status: 'pending',
          message: 'Send payment to complete purchase',
          amount: amount,
          cost_usd: amount * CREDIT_RATES.buyRate,
          wallet: '0xbeA0895a832d591849124b6F20206492f7A5Dec0', // USDC on Base
          instructions: 'Send USDC on Base, then call again with payment_proof (tx hash)',
        });
      }

      // Credit the account (in production, verify tx first)
      await addCredits(soul_id, amount, 'purchased');
      
      return NextResponse.json({
        status: 'success',
        message: `Purchased ${amount} credits`,
        new_balance: agent.credits + amount,
      });

    } else if (action === 'cashout') {
      // Cash out credits to crypto
      if (!amount || amount < 100) {
        return NextResponse.json({ 
          error: 'Minimum cashout: 100 credits',
          value: `$${(100 * CREDIT_RATES.cashOutRate).toFixed(2)}`,
        }, { status: 400 });
      }

      if (agent.credits < amount) {
        return NextResponse.json({ 
          error: 'Insufficient credits',
          available: agent.credits,
          requested: amount,
        }, { status: 402 });
      }

      // Deduct credits
      const success = await deductCredits(soul_id, amount, 'cashout');
      if (!success) {
        return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
      }

      const payoutUsd = amount * CREDIT_RATES.cashOutRate;

      return NextResponse.json({
        status: 'pending_payout',
        message: `Cashout initiated for ${amount} credits`,
        payout_usd: payoutUsd,
        new_balance: agent.credits - amount,
        instructions: 'Payout will be sent within 24 hours (manual process for now)',
        // TODO: Implement automatic crypto payouts
      });

    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use: buy or cashout',
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Credits error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
