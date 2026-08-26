"""
Pillar 2: 4-agent swarm quorum — Python mirror of src/swarm/*.ts
Deterministic, no external keys required. Mock signatures via HMAC-SHA256.
"""
import hashlib
import hmac
import os
from typing import Any

AGENT_SECRETS = {
    "triangulator": os.environ.get("AGENT_TRIANGULATOR_SECRET", "aegis-triangulator-v1-secret-2026"),
    "fact_checker": os.environ.get("AGENT_FACT_CHECKER_SECRET", "aegis-fact-checker-v1-secret-2026"),
    "triage_evaluator": os.environ.get("AGENT_TRIAGE_SECRET", "aegis-triage-v1-secret-2026"),
    "risk_governor": os.environ.get("AGENT_GOVERNOR_SECRET", "aegis-governor-v1-secret-2026"),
}

def sign_vote(agent_type: str, cluster_id: str, vote: str, score: float) -> str:
    secret = AGENT_SECRETS.get(agent_type, "aegis-fallback-secret").encode()
    payload = f"{agent_type}:{cluster_id}:{vote}:{score:.3f}".encode()
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()

def quorum_hash(votes) -> str:
    sorted_votes = sorted(votes, key=lambda v: v["agentType"])
    payload = "|".join(f"{v['agentType']}:{v['vote']}:{v['signature'][:16]}" for v in sorted_votes)
    return hashlib.sha256(payload.encode()).hexdigest()

# ── Agents ──

def triangulator(cluster: dict) -> dict:
    rc = cluster.get("reportCount", 1)
    radius = cluster.get("radiusM", 500)
    sources = cluster.get("sources", [])
    score = 0.4
    if rc >= 2: score += 0.2
    if rc >= 4: score += 0.15
    if radius <= 300: score += 0.15
    elif radius <= 800: score += 0.08
    if len(sources) >= 2: score += 0.1
    if len(sources) >= 3: score += 0.05
    if len(sources) == 1 and sources[0] == "anonymous_tip": score -= 0.25
    score = max(0, min(1, score))
    vote = "yes" if score >= 0.6 else "abstain" if score >= 0.35 else "no"
    reasoning = f"Cluster: {rc} reports within {round(radius)}m, {len(sources)} source types."
    sig = sign_vote("triangulator", cluster["clusterId"], vote, score)
    return {"agentType":"triangulator","vote":vote,"score":round(score,3),"reasoning":reasoning,"signature":sig,"toolProofs":{"reportCount":rc,"radiusM":radius,"sources":sources}}

def fact_checker(cluster: dict) -> dict:
    text = " ".join(cluster.get("rawTexts", []))
    lat, lon = cluster.get("lat", 0), cluster.get("lon", 0)
    low = text.lower()
    # news
    if any(k in low for k in ["bomb","explosion","attack","gunfire","terror","blast","armed"]):
        news_found, news_detail = True, "Verified explosion/attack in last 60min, emergency on scene."
        is_attack = True
    elif any(k in low for k in ["flood","water","inundat","overflow"]):
        news_found, news_detail = True, "Heavy flooding, submerged streets within 3h."
        is_attack = False
    elif any(k in low for k in ["fire","wildfire","blaze","smoke"]):
        news_found, news_detail = True, "FIRMS thermal anomaly + evacuation order."
        is_attack = False
    else:
        news_found, news_detail = False, "No corroborating news in last 3h."
        is_attack = False
    # weather (location-agnostic)
    weather_anomaly = -30 < lat < 30
    # satellite
    if "flood" in low or "water" in low:
        sat_match, sat_detail = True, f"Sentinel-2 NDWI 0.62 vs 0.21 at {lat:.2f},{lon:.2f} inundation."
    elif "fire" in low:
        sat_match, sat_detail = True, f"FIRMS 387K anomaly at {lat:.2f},{lon:.2f}."
    elif is_attack:
        sat_match, sat_detail = False, f"Sentinel-2 optical at {lat:.2f},{lon:.2f}: No structural anomaly."
    else:
        sat_match, sat_detail = False, f"Sentinel-2 at {lat:.2f},{lon:.2f}: ΔNDVI <0.03."
    if is_attack:
        if news_found:
            score, vote, reasoning = 0.82, "yes", f"Attack corroborated: {news_detail}"
        else:
            score, vote, reasoning = 0.22, "no", "No news corroboration for attack — requires human audit."
    else:
        cor = sum([news_found, weather_anomaly, sat_match])
        if cor >=2:
            score, vote, reasoning = 0.78+cor*0.06, "yes", f"{cor}/3 corroborations: news={news_found} weather={weather_anomaly} sat={sat_match}"
        elif cor==1:
            score, vote, reasoning = 0.42, "abstain", "Only 1/3 corroborations — insufficient."
        else:
            score, vote, reasoning = 0.18, "no", f"0/3 corroborations. News: {news_detail}"
    score = round(max(0,min(1,score)),3)
    sig = sign_vote("fact_checker", cluster["clusterId"], vote, score)
    return {"agentType":"fact_checker","vote":vote,"score":score,"reasoning":reasoning,"signature":sig,"toolProofs":{"news":{"found":news_found,"detail":news_detail},"satellite":{"match":sat_match,"detail":sat_detail}}}

def triage_evaluator(cluster: dict) -> dict:
    scores = cluster.get("urgencyScores", [1])
    max_u = max(scores) if scores else 1
    text = " ".join(cluster.get("rawTexts", [])).lower()
    rc = cluster.get("reportCount", 1)
    # tier
    if max_u >=5 and any(k in text for k in ["trapped","casualt","dead","fatal","destroyed","collapse"]):
        tier=4
    elif max_u>=5 or any(k in text for k in ["hundreds","many","widespread","evacuate now","rapidly rising"]):
        tier=3
    elif max_u>=4 or any(k in text for k in ["injured","major damage","spreading fast"]):
        tier=2
    elif max_u>=3:
        tier=2
    else:
        tier=1
    caps = {1:0,2:5000,3:15000,4:40000}
    floors = {1:0,2:5000,3:15000,4:40000}
    amount = floors.get(tier,0) + max_u*2500 + rc*1500
    if "hundreds" in text or "many" in text: amount+=20000
    if any(k in text for k in ["infrastructure","destroyed","bridge"]): amount+=30000
    if any(k in text for k in ["casualt","death","dead"]): amount+=25000
    if "hospital" in text or "clinic" in text: amount+=15000
    amount = min(amount, caps.get(tier, amount))
    if tier==1:
        vote, score, reasoning = "abstain", 0.35, f"Tier 1 — monitor, urgency {max_u}, $0"
    elif tier==2:
        vote, score, reasoning = "yes", 0.68, f"Tier 2 — moderate, urgency {max_u}, tier {tier}, ${amount}"
    elif tier==3:
        vote, score, reasoning = "yes", 0.84, f"Tier 3 — high, urgency {max_u}, tier {tier}, ${amount}"
    else:
        vote, score, reasoning = "yes", 0.92, f"Tier 4 — catastrophic, urgency {max_u}, tier {tier}, ${amount}"
    sig = sign_vote("triage_evaluator", cluster["clusterId"], vote, score)
    return {"agentType":"triage_evaluator","vote":vote,"score":score,"reasoning":reasoning,"signature":sig,"toolProofs":{"tier":tier,"maxUrgency":max_u,"amount":amount,"reportCount":rc}}

def risk_governor(cluster: dict) -> dict:
    # vault snapshot injected or default
    vault = cluster.get("vault", {"reserveUSD":1_000_000,"dailyLimitUSD":100_000,"disbursedTodayUSD":12_500})
    sources = cluster.get("sources", [])
    tier = cluster.get("_tier")  # injected from triage
    if tier is None:
        scores = cluster.get("urgencyScores",[1])
        tier = 4 if max(scores)>=5 else 3 if max(scores)>=4 else 2
    hard_caps = {1:0,2:5000,3:15000,4:25000}
    hard_cap = hard_caps.get(tier, 5000)
    requested = cluster.get("_requestedAmount", cluster.get("totalFinancialTarget",0))
    remaining_daily = vault["dailyLimitUSD"] - vault["disbursedTodayUSD"]
    remaining_reserve = vault["reserveUSD"]
    capped = min(requested, hard_cap, remaining_daily, remaining_reserve*0.1)
    effective = max(0, round(capped/100)*100)
    if effective <=0:
        vote, score, reasoning = "no", 0.15, f"Veto: daily remaining ${remaining_daily}, reserve ${remaining_reserve}, cap ${hard_cap}, requested ${requested} -> $0"
    elif remaining_daily < hard_cap*0.2:
        vote, score, reasoning = "abstain", 0.45, f"Daily limit stressed, capped {requested} -> {effective} tier {tier}"
    elif "anonymous_tip" in sources and tier>=3:
        vote, score, reasoning = "abstain", 0.4, f"Anonymous tip tier {tier} escalates risk — capped to {effective}"
    else:
        vote, score, reasoning = "yes", 0.88, f"Approved tier {tier} cap ${hard_cap}, daily remaining ${remaining_daily}, requested {requested} -> approved {effective}"
    sig = sign_vote("risk_governor", cluster["clusterId"], vote, score)
    return {"agentType":"risk_governor","vote":vote,"score":score,"reasoning":reasoning,"signature":sig,"toolProofs":{"tier":tier,"hardCap":hard_cap,"requested":requested,"effective":effective,"vault":vault}}

def run_quorum(cluster: dict) -> dict:
    tri = triage_evaluator(cluster)
    tier = tri["toolProofs"]["tier"]
    amount = tri["toolProofs"]["amount"]
    cluster["_tier"]=tier
    cluster["_requestedAmount"]=amount
    tria = triangulator(cluster)
    fact = fact_checker(cluster)
    gov = risk_governor(cluster)
    votes = [tria, fact, tri, gov]
    yes = sum(1 for v in votes if v["vote"]=="yes")
    quorum = yes>=3
    capped = gov["toolProofs"]["effective"]
    if quorum and capped>0:
        status="verified"
    elif sum(1 for v in votes if v["vote"]=="no")>=2:
        status="quarantined"
    else:
        status="audit_required"
    qh = quorum_hash(votes)
    return {"clusterId":cluster["clusterId"],"votes":votes,"yesCount":yes,"quorumReached":quorum,"status":status,"tier":tier,"cappedAmountUSD":capped,"quorumHash":qh}
