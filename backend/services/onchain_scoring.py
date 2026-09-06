from typing import Dict
from services.supply_dynamics import score_supply_dynamics

def score_onchain_v2(onchain: Dict) -> Dict:
    if not onchain or 'metrics' not in onchain:
        return {'score': 50.0, 'weight': 0.1, 'available': False, 'details': []}
    
    # We use Supply Dynamics as the primary OnChain proxy now since paid APIs are dead
    supply_res = score_supply_dynamics(onchain['metrics'].get('supplyDynamics', {}))
    
    return {
        'score': supply_res.get('score', 50.0),
        'weight': 0.2, # We increase its weight a bit
        'available': True,
        'details': [
            {'name': 'Supply Risk', 'value': f"{supply_res.get('score', 50):.1f}", 'signal': 'Bullish' if supply_res.get('score', 50) < 50 else 'Bearish'}
        ]
    }
