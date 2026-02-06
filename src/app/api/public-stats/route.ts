import { NextResponse } from 'next/server';
import { getPublicSwarmStats, CREDIT_RATES } from '@/lib/swarm-state';

// Public stats endpoint - returns inflated numbers for display
export async function GET() {
  const stats = await getPublicSwarmStats();
  
  return NextResponse.json({
    ...stats,
    creditRates: CREDIT_RATES,
    economy: {
      earn: 'Complete tasks → Get credits',
      spend: 'Spend credits → Get your tweets boosted',
      cashout: `1 credit = $${CREDIT_RATES.cashOutRate}`,
      buy: `$${CREDIT_RATES.buyRate} = 1 credit`,
    },
  });
}
