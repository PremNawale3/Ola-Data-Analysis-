"""
OLA Analytics Dashboard — FastAPI Backend
Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime, date
import sqlite3, os, json

DB_PATH = os.path.join(os.path.dirname(__file__), "ola.db")

app = FastAPI(
    title="OLA Analytics API",
    description="Backend for the OLA Data Analysis Dashboard",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── DB HELPERS ──────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def q(sql: str, params=(), many=True):
    conn = get_db()
    cur = conn.execute(sql, params)
    rows = cur.fetchall() if many else cur.fetchone()
    conn.close()
    return [dict(r) for r in rows] if many else (dict(rows) if rows else None)

# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    row = q("SELECT COUNT(*) AS cnt FROM rides", many=False)
    return {"status": "ok", "ride_count": row["cnt"] if row else 0}

# ─── KPI SUMMARY ─────────────────────────────────────────────────────────────

@app.get("/api/kpis", tags=["Dashboard"])
def get_kpis(year: Optional[int] = None):
    """Aggregate KPIs for the KPI card row."""
    where = "WHERE CAST(strftime('%Y', pickup_dt) AS INT) = ?" if year else ""
    params = (year,) if year else ()

    row = q(f"""
        SELECT
          COUNT(*)               AS total_rides,
          ROUND(SUM(fare),2)     AS total_revenue,
          ROUND(AVG(fare),2)     AS avg_fare,
          ROUND(AVG(distance),2) AS avg_distance,
          SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) AS cancellations,
          ROUND(AVG(rating),2)   AS avg_rating
        FROM rides {where}
    """, params, many=False)

    solo = q(f"""
        SELECT COUNT(*) AS cnt FROM rides {where}
        {'AND' if year else 'WHERE'} passenger_count = 1
    """, params if year else (), many=False)

    row["solo_pct"] = round(solo["cnt"] / row["total_rides"] * 100, 1) if row["total_rides"] else 0
    return row

# ─── REVENUE ─────────────────────────────────────────────────────────────────

@app.get("/api/revenue/yearly", tags=["Revenue"])
def revenue_yearly():
    return q("""
        SELECT
          strftime('%Y', pickup_dt)   AS year,
          COUNT(*)                    AS rides,
          ROUND(SUM(fare), 2)         AS revenue,
          ROUND(AVG(fare), 2)         AS avg_fare
        FROM rides
        GROUP BY year ORDER BY year
    """)

@app.get("/api/revenue/monthly", tags=["Revenue"])
def revenue_monthly(year: Optional[int] = None):
    where = "WHERE CAST(strftime('%Y', pickup_dt) AS INT) = ?" if year else ""
    params = (year,) if year else ()
    return q(f"""
        SELECT
          strftime('%Y-%m', pickup_dt) AS month,
          COUNT(*)                     AS rides,
          ROUND(SUM(fare), 2)          AS revenue,
          ROUND(AVG(fare), 2)          AS avg_fare
        FROM rides {where}
        GROUP BY month ORDER BY month
    """, params)

@app.get("/api/revenue/by-pax", tags=["Revenue"])
def revenue_by_pax():
    return q("""
        SELECT
          passenger_count             AS pax,
          COUNT(*)                    AS rides,
          ROUND(SUM(fare), 2)         AS revenue,
          ROUND(AVG(fare), 2)         AS avg_fare
        FROM rides
        WHERE passenger_count BETWEEN 1 AND 6
        GROUP BY passenger_count ORDER BY passenger_count
    """)

@app.get("/api/revenue/fare-distribution", tags=["Revenue"])
def fare_distribution():
    return q("""
        SELECT
          CASE
            WHEN fare < 5         THEN '$0-5'
            WHEN fare < 10        THEN '$5-10'
            WHEN fare < 15        THEN '$10-15'
            WHEN fare < 20        THEN '$15-20'
            WHEN fare < 30        THEN '$20-30'
            ELSE '$30+'
          END AS bucket,
          COUNT(*) AS trips
        FROM rides
        GROUP BY bucket
        ORDER BY MIN(fare)
    """)

# ─── RIDES / BOOKINGS ────────────────────────────────────────────────────────

@app.get("/api/rides/hourly", tags=["Bookings"])
def rides_hourly(year: Optional[int] = None):
    where = "WHERE CAST(strftime('%Y', pickup_dt) AS INT) = ?" if year else ""
    params = (year,) if year else ()
    return q(f"""
        SELECT
          CAST(strftime('%H', pickup_dt) AS INT) AS hour,
          COUNT(*)                               AS rides,
          ROUND(AVG(fare), 2)                    AS avg_fare
        FROM rides {where}
        GROUP BY hour ORDER BY hour
    """, params)

@app.get("/api/rides/by-zone", tags=["Bookings"])
def rides_by_zone():
    return q("""
        SELECT
          zone,
          COUNT(*)            AS rides,
          ROUND(SUM(fare),2)  AS revenue,
          ROUND(AVG(fare),2)  AS avg_fare
        FROM rides
        GROUP BY zone ORDER BY rides DESC
    """)

@app.get("/api/rides/status-breakdown", tags=["Bookings"])
def rides_status():
    return q("""
        SELECT status, COUNT(*) AS count
        FROM rides GROUP BY status ORDER BY count DESC
    """)

# ─── DRIVERS ─────────────────────────────────────────────────────────────────

@app.get("/api/drivers", tags=["Drivers"])
def get_drivers(
    limit: int = Query(20, le=100),
    offset: int = 0,
    sort_by: str = "rides",
    order: str = "desc"
):
    allowed = {"rides","revenue","avg_fare","rating","completion_rate"}
    if sort_by not in allowed:
        raise HTTPException(400, f"sort_by must be one of {allowed}")
    direction = "DESC" if order == "desc" else "ASC"
    return q(f"""
        SELECT
          d.driver_id, d.name, d.zone,
          COUNT(r.ride_id)            AS rides,
          ROUND(SUM(r.fare), 2)       AS revenue,
          ROUND(AVG(r.fare), 2)       AS avg_fare,
          ROUND(AVG(r.rating), 2)     AS rating,
          ROUND(
            100.0 * SUM(CASE WHEN r.status='Completed' THEN 1 ELSE 0 END) / COUNT(*), 1
          )                           AS completion_rate,
          d.trend_pct
        FROM drivers d
        LEFT JOIN rides r ON r.driver_id = d.driver_id
        GROUP BY d.driver_id
        ORDER BY {sort_by} {direction}
        LIMIT ? OFFSET ?
    """, (limit, offset))

@app.get("/api/drivers/{driver_id}", tags=["Drivers"])
def get_driver_detail(driver_id: str):
    driver = q("SELECT * FROM drivers WHERE driver_id=?", (driver_id,), many=False)
    if not driver:
        raise HTTPException(404, "Driver not found")
    stats = q("""
        SELECT strftime('%Y-%m', pickup_dt) AS month,
               COUNT(*) AS rides, ROUND(SUM(fare),2) AS revenue
        FROM rides WHERE driver_id=?
        GROUP BY month ORDER BY month
    """, (driver_id,))
    driver["monthly_stats"] = stats
    return driver

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.get("/api/routes/top", tags=["Routes"])
def top_routes(limit: int = Query(10, le=50)):
    return q("""
        SELECT
          pickup_zone || ' → ' || dropoff_zone AS route,
          pickup_zone, dropoff_zone,
          COUNT(*)            AS trips,
          ROUND(AVG(fare),2)  AS avg_fare,
          ROUND(AVG(distance),2) AS avg_dist
        FROM rides
        WHERE pickup_zone IS NOT NULL AND dropoff_zone IS NOT NULL
        GROUP BY pickup_zone, dropoff_zone
        ORDER BY trips DESC
        LIMIT ?
    """, (limit,))

# ─── RAW RIDES TABLE (paginated + filtered) ──────────────────────────────────

@app.get("/api/rides", tags=["Raw Data"])
def list_rides(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, le=200),
    year: Optional[int] = None,
    zone: Optional[str] = None,
    status: Optional[str] = None,
    min_fare: Optional[float] = None,
    max_fare: Optional[float] = None,
    search: Optional[str] = None,
):
    conditions, params = [], []
    if year:       conditions.append("CAST(strftime('%Y', pickup_dt) AS INT) = ?"); params.append(year)
    if zone:       conditions.append("zone = ?");       params.append(zone)
    if status:     conditions.append("status = ?");     params.append(status)
    if min_fare:   conditions.append("fare >= ?");      params.append(min_fare)
    if max_fare:   conditions.append("fare <= ?");      params.append(max_fare)
    if search:     conditions.append("(ride_id LIKE ? OR zone LIKE ?)"); params += [f"%{search}%", f"%{search}%"]

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    total = q(f"SELECT COUNT(*) AS cnt FROM rides {where}", params, many=False)["cnt"]
    offset = (page - 1) * page_size
    rows = q(f"""
        SELECT ride_id, pickup_dt, fare, distance, passenger_count,
               zone, pickup_zone, dropoff_zone, status, rating, driver_id
        FROM rides {where}
        ORDER BY pickup_dt DESC
        LIMIT ? OFFSET ?
    """, params + [page_size, offset])

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "data": rows,
    }
