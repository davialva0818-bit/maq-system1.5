"""Inteligência de Roteiros: agrupa OS por região/cidade/bairro e otimiza a sequência (sem LLM)."""
import logging
import math
from typing import List, Optional

import httpx
import numpy as np
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from routes_module import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/routes", tags=["routes"], dependencies=[Depends(verify_token)])

OSRM_URL = "https://router.project-osrm.org/table/v1/driving/"
ROAD_FACTOR = 1.35


class IntelOS(BaseModel):
    os_number: str
    lat: float
    lng: float
    city: Optional[str] = ""
    neighborhood: Optional[str] = ""
    priority: Optional[bool] = False
    days_open: Optional[int] = 0


class IntelRequest(BaseModel):
    orders: List[IntelOS]
    base_lat: float
    base_lng: float
    max_routes: int = 4
    max_stops: int = 9
    service_minutes: int = 45
    day_minutes: int = 540
    radius_minutes: float = 25
    start_time: str = "08:00"


def _norm(s):
    return (s or "").strip().lower()


def _hav_matrix(lat, lng):
    la, lo = np.radians(lat), np.radians(lng)
    dlat = la[:, None] - la[None, :]
    dlng = lo[:, None] - lo[None, :]
    a = np.sin(dlat / 2) ** 2 + np.cos(la[:, None]) * np.cos(la[None, :]) * np.sin(dlng / 2) ** 2
    return 12742 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def _est_minutes(km):
    road = km * ROAD_FACTOR
    # Trechos curtos são urbanos (~28 km/h); longos usam rodovia (~55 km/h).
    return np.where(road < 15, road / 28 * 60, 15 / 28 * 60 + (road - 15) / 55 * 60)


def _dbscan(T, eps, min_pts=2):
    n = len(T)
    labels = [-1] * n
    cid = 0
    for i in range(n):
        if labels[i] != -1:
            continue
        nb = list(np.where(T[i] <= eps)[0])
        if len(nb) < min_pts:
            continue
        labels[i] = cid
        queue = [j for j in nb if j != i]
        while queue:
            j = queue.pop()
            if labels[j] == -1:
                labels[j] = cid
                nb_j = np.where(T[j] <= eps)[0]
                if len(nb_j) >= min_pts:
                    queue.extend(k for k in nb_j if labels[k] == -1)
        cid += 1
    for i in range(n):
        if labels[i] == -1:
            labels[i] = cid
            cid += 1
    return labels


def _tour_cost(seq, T):
    # seq inclui a base (índice 0) no início e no fim
    return sum(T[seq[i], seq[i + 1]] for i in range(len(seq) - 1))


def _best_insertion(seq, k, T):
    best, pos = math.inf, 1
    for i in range(len(seq) - 1):
        d = T[seq[i], k] + T[k, seq[i + 1]] - T[seq[i], seq[i + 1]]
        if d < best:
            best, pos = d, i + 1
    return best, pos


def _two_opt(seq, T):
    improved = True
    while improved:
        improved = False
        for i in range(1, len(seq) - 2):
            for j in range(i + 1, len(seq) - 1):
                new = seq[:i] + seq[i:j + 1][::-1] + seq[j + 1:]
                if _tour_cost(new, T) + 1e-6 < _tour_cost(seq, T):
                    seq, improved = new, True
    return seq


def _direction(base_lat, base_lng, lat, lng):
    dy = (lat - base_lat) * 111
    dx = (lng - base_lng) * 111 * math.cos(math.radians(base_lat))
    if math.hypot(dx, dy) < 3:
        return "Centro"
    ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
    return ["Leste", "Nordeste", "Norte", "Noroeste", "Oeste", "Sudoeste", "Sul", "Sudeste"][int(((ang + 22.5) % 360) // 45)]


async def _osrm_matrix(coords):
    """coords: [(lat,lng)]. Retorna (minutos, km) pelas ruas, ou None se indisponível."""
    path = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in coords)
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.get(OSRM_URL + path, params={"annotations": "duration,distance"})
        data = r.json()
        if data.get("code") != "Ok":
            return None
        return np.array(data["durations"], dtype=float) / 60, np.array(data["distances"], dtype=float) / 1000
    except Exception as e:
        logger.warning(f"OSRM indisponível: {e!r}")
        return None


def _build_routes(req: IntelRequest, T):
    """T: matriz de minutos estimados com a base no índice 0."""
    orders = req.orders
    n = len(orders)
    pts = T[1:, 1:]
    labels = _dbscan(pts, eps=min(12, req.radius_minutes))
    region_score = {}
    for i, lb in enumerate(labels):
        o = orders[i]
        region_score[lb] = region_score.get(lb, 0) + 1 + (1.5 if o.priority else 0) + min(o.days_open or 0, 60) / 60
    unassigned = set(range(n))
    routes = []
    for _ in range(req.max_routes):
        if not unassigned:
            break
        live = {lb: s for lb, s in region_score.items() if any(labels[i] == lb for i in unassigned)}
        region = max(live, key=live.get)
        members = [i for i in unassigned if labels[i] == region]
        # semente: OS mais "central" da região (mais vizinhas dentro do raio)
        seed = max(members, key=lambda i: (sum(1 for j in members if pts[i, j] <= req.radius_minutes), orders[i].priority))
        seq = [0, seed + 1, 0]
        unassigned.discard(seed)
        while len(seq) - 2 < req.max_stops:
            stops = [s - 1 for s in seq[1:-1]]
            best = None
            for k in unassigned:
                near = min(pts[k, s] for s in stops)
                if near > req.radius_minutes:
                    continue
                delta, pos = _best_insertion(seq, k + 1, T)
                same_nb = any(_norm(orders[k].neighborhood) and _norm(orders[k].neighborhood) == _norm(orders[s].neighborhood) for s in stops)
                same_city = any(_norm(orders[k].city) == _norm(orders[s].city) for s in stops)
                score = delta - (4 if same_nb else 0) - (1.5 if same_city else 0) - (3 if orders[k].priority else 0)
                if best is None or score < best[0]:
                    best = (score, k, pos)
            if best is None:
                break
            _, k, pos = best
            trial = seq[:pos] + [k + 1] + seq[pos:]
            if _tour_cost(trial, T) + req.service_minutes * (len(trial) - 2) > req.day_minutes:
                break
            seq = trial
            unassigned.discard(k)
        routes.append([s - 1 for s in _two_opt(seq, T)[1:-1]])
    return routes, len(unassigned)


def _hhmm_add(start, minutes):
    h, m = map(int, start.split(":"))
    t = h * 60 + m + int(round(minutes))
    return f"{(t // 60) % 24:02d}:{t % 60:02d}"


async def _describe(req: IntelRequest, idx_list, Test, Kest):
    orders = req.orders
    coords = [(req.base_lat, req.base_lng)] + [(orders[i].lat, orders[i].lng) for i in idx_list]
    real = await _osrm_matrix(coords)
    local = [0] + [i + 1 for i in idx_list]
    if real:
        Tm, Km = real
        source = "ruas (OSRM)"
    else:
        Tm, Km = Test[np.ix_(local, local)], Kest[np.ix_(local, local)] * ROAD_FACTOR
        source = "estimado"
    seq = _two_opt(list(range(len(local))) + [0], Tm)
    stops, clock = [], 0.0
    for a, b in zip(seq[:-2], seq[1:-1]):
        clock += Tm[a, b]
        o = orders[idx_list[b - 1]]
        stops.append({"os_number": o.os_number, "eta": _hhmm_add(req.start_time, clock), "leg_minutes": round(float(Tm[a, b]))})
        clock += req.service_minutes
    travel = _tour_cost(seq, Tm)
    km = _tour_cost(seq, Km)
    sel = [orders[i] for i in idx_list]
    cities, nbs = {}, {}
    for o in sel:
        c = (o.city or "").strip().title() or "Sem cidade"
        cities[c] = cities.get(c, 0) + 1
        nb = (o.neighborhood or "").strip().title()
        if nb:
            nbs[nb] = nbs.get(nb, 0) + 1
    clat = sum(o.lat for o in sel) / len(sel)
    clng = sum(o.lng for o in sel) / len(sel)
    return {
        "region": _direction(req.base_lat, req.base_lng, clat, clng),
        "cities": sorted(cities, key=cities.get, reverse=True),
        "neighborhoods": sorted(nbs, key=nbs.get, reverse=True)[:4],
        "stops": stops,
        "travel_minutes": round(float(travel)),
        "total_minutes": round(float(travel) + req.service_minutes * len(stops)),
        "distance_km": round(float(km), 1),
        "end_time": _hhmm_add(req.start_time, travel + req.service_minutes * len(stops)),
        "source": source,
    }


@router.post("/regional-suggestions")
async def regional_suggestions(req: IntelRequest):
    if len(req.orders) < 1:
        return {"routes": [], "grouped": 0, "unassigned": 0}
    lat = np.array([req.base_lat] + [o.lat for o in req.orders])
    lng = np.array([req.base_lng] + [o.lng for o in req.orders])
    K = _hav_matrix(lat, lng)
    T = _est_minutes(K)
    routes, left = _build_routes(req, T)
    out = []
    for n, idx in enumerate(routes, 1):
        d = await _describe(req, idx, T, K)
        d["name"] = f"Roteiro {n} · Região {d['region']}"
        out.append(d)
    return {"routes": out, "grouped": sum(len(r["stops"]) for r in out), "unassigned": left}
