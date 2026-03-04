"""
OLA Analytics — End-to-End Backend Test Suite
Run: python test_backend.py
Tests all API endpoint logic directly against the SQLite database.
"""

import sqlite3, sys, json, math, traceback
from datetime import datetime

DB  = "ola.db"
PASS = "✅"
FAIL = "❌"
results = []

def test(name, fn):
    try:
        fn()
        print(f"  {PASS}  {name}")
        results.append((name, True, None))
    except AssertionError as e:
        print(f"  {FAIL}  {name}  →  {e}")
        results.append((name, False, str(e)))
    except Exception as e:
        print(f"  {FAIL}  {name}  →  {traceback.format_exc().splitlines()[-1]}")
        results.append((name, False, str(e)))

def q(sql, params=(), many=True):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.execute(sql, params)
    rows = cur.fetchall() if many else cur.fetchone()
    conn.close()
    return [dict(r) for r in rows] if many else (dict(rows) if rows else None)

# ── SECTION 1: Database integrity ────────────────────────────────────────────
print("\n📦 SECTION 1 — Database Integrity")

test("Rides table exists and has 10,000+ rows", lambda:
    (_ for _ in ()).throw(AssertionError(f"Expected ≥10000, got {q('SELECT COUNT(*) AS c FROM rides',many=False)['c']}"))
    if q("SELECT COUNT(*) AS c FROM rides", many=False)["c"] < 10000
    else None
)

test("Drivers table has exactly 50 rows", lambda:
    (_ for _ in ()).throw(AssertionError(f"Got {q('SELECT COUNT(*) AS c FROM drivers',many=False)['c']}"))
    if q("SELECT COUNT(*) AS c FROM drivers", many=False)["c"] != 50
    else None
)

test("No NULL ride_ids", lambda:
    (_ for _ in ()).throw(AssertionError("Found NULL ride_ids"))
    if q("SELECT COUNT(*) AS c FROM rides WHERE ride_id IS NULL", many=False)["c"] > 0
    else None
)

test("No NULL driver references (all driver_ids exist)", lambda:
    (_ for _ in ()).throw(AssertionError("Orphaned driver references"))
    if q("SELECT COUNT(*) AS c FROM rides r WHERE NOT EXISTS (SELECT 1 FROM drivers d WHERE d.driver_id=r.driver_id)", many=False)["c"] > 0
    else None
)

test("All fares are positive", lambda:
    (_ for _ in ()).throw(AssertionError("Non-positive fares found"))
    if q("SELECT COUNT(*) AS c FROM rides WHERE fare <= 0", many=False)["c"] > 0
    else None
)

test("Passenger count in valid range 1–6", lambda:
    (_ for _ in ()).throw(AssertionError("Out-of-range passenger counts"))
    if q("SELECT COUNT(*) AS c FROM rides WHERE passenger_count < 1 OR passenger_count > 6", many=False)["c"] > 0
    else None
)

test("Status only has valid values", lambda:
    (_ for _ in ()).throw(AssertionError("Invalid status values found"))
    if q("SELECT COUNT(*) AS c FROM rides WHERE status NOT IN ('Completed','Late','Cancelled')", many=False)["c"] > 0
    else None
)

test("Date range is 2009–2015", lambda: None if (
    q("SELECT MIN(strftime('%Y',pickup_dt)) AS mn, MAX(strftime('%Y',pickup_dt)) AS mx FROM rides", many=False)
    == {"mn":"2009","mx":"2015"}
) else (_ for _ in ()).throw(AssertionError("Date range mismatch")))

test("Zone values are non-empty", lambda:
    (_ for _ in ()).throw(AssertionError("Empty zone values"))
    if q("SELECT COUNT(*) AS c FROM rides WHERE zone IS NULL OR zone=''", many=False)["c"] > 0
    else None
)

# ── SECTION 2: KPI endpoint logic ────────────────────────────────────────────
print("\n📊 SECTION 2 — KPI Endpoint Logic")

kpis = q("""SELECT COUNT(*) AS total_rides, ROUND(SUM(fare),2) AS total_revenue,
    ROUND(AVG(fare),2) AS avg_fare, ROUND(AVG(distance),2) AS avg_distance,
    SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) AS cancellations,
    ROUND(AVG(rating),2) AS avg_rating FROM rides""", many=False)

test("KPIs: total_rides >= 10000",         lambda: None if kpis["total_rides"] >= 10000 else (_ for _ in ()).throw(AssertionError(kpis["total_rides"])))
test("KPIs: total_revenue > 0",            lambda: None if kpis["total_revenue"] > 0 else (_ for _ in ()).throw(AssertionError()))
test("KPIs: avg_fare between $5–$100",     lambda: None if 5 <= kpis["avg_fare"] <= 100 else (_ for _ in ()).throw(AssertionError(kpis["avg_fare"])))
test("KPIs: avg_distance > 0",             lambda: None if kpis["avg_distance"] > 0 else (_ for _ in ()).throw(AssertionError()))
test("KPIs: cancellations < 15% of total", lambda: None if kpis["cancellations"]/kpis["total_rides"] < 0.15 else (_ for _ in ()).throw(AssertionError(f"{kpis['cancellations']}/{kpis['total_rides']}")))
test("KPIs: avg_rating between 3.0–5.0",   lambda: None if 3.0 <= kpis["avg_rating"] <= 5.0 else (_ for _ in ()).throw(AssertionError(kpis["avg_rating"])))

# Year filter test
kpis_2013 = q("""SELECT COUNT(*) AS rides, ROUND(SUM(fare),2) AS rev FROM rides
    WHERE CAST(strftime('%Y',pickup_dt) AS INT) = 2013""", many=False)
test("KPIs year filter: 2013 has > 1000 rides", lambda: None if kpis_2013["rides"] > 1000 else (_ for _ in ()).throw(AssertionError(kpis_2013["rides"])))
test("KPIs year filter: 2013 revenue > 0",      lambda: None if kpis_2013["rev"] > 0 else (_ for _ in ()).throw(AssertionError()))

# ── SECTION 3: Revenue endpoints ─────────────────────────────────────────────
print("\n💰 SECTION 3 — Revenue Endpoints")

yearly = q("SELECT strftime('%Y',pickup_dt) AS year, COUNT(*) AS rides, ROUND(SUM(fare),2) AS rev FROM rides GROUP BY year ORDER BY year")
test("Revenue yearly: returns 7 years",       lambda: None if len(yearly)==7 else (_ for _ in ()).throw(AssertionError(len(yearly))))
test("Revenue yearly: all years have rides",  lambda: None if all(y["rides"]>0 for y in yearly) else (_ for _ in ()).throw(AssertionError()))
test("Revenue yearly: revenue sums match KPI",lambda: None if abs(sum(y["rev"] for y in yearly) - kpis["total_revenue"]) < 1 else (_ for _ in ()).throw(AssertionError(sum(y["rev"] for y in yearly))))

pax = q("SELECT passenger_count AS pax, COUNT(*) AS rides, ROUND(SUM(fare),2) AS rev FROM rides WHERE passenger_count BETWEEN 1 AND 6 GROUP BY pax ORDER BY pax")
test("Revenue by-pax: 6 groups",              lambda: None if len(pax)==6 else (_ for _ in ()).throw(AssertionError(len(pax))))
test("Revenue by-pax: single pax is largest", lambda: None if pax[0]["rides"] == max(p["rides"] for p in pax) else (_ for _ in ()).throw(AssertionError()))

fare_dist = q("""SELECT CASE WHEN fare<5 THEN '$0-5' WHEN fare<10 THEN '$5-10' WHEN fare<15 THEN '$10-15'
    WHEN fare<20 THEN '$15-20' WHEN fare<30 THEN '$20-30' ELSE '$30+' END AS bucket,
    COUNT(*) AS trips FROM rides GROUP BY bucket ORDER BY MIN(fare)""")
test("Fare distribution: 6 buckets",         lambda: None if len(fare_dist)==6 else (_ for _ in ()).throw(AssertionError(len(fare_dist))))
test("Fare distribution: total matches rides",lambda: None if abs(sum(b["trips"] for b in fare_dist) - kpis["total_rides"]) < 10 else (_ for _ in ()).throw(AssertionError()))

# ── SECTION 4: Bookings endpoints ────────────────────────────────────────────
print("\n🗓  SECTION 4 — Bookings Endpoints")

hourly = q("SELECT CAST(strftime('%H',pickup_dt) AS INT) AS hour, COUNT(*) AS rides FROM rides GROUP BY hour ORDER BY hour")
test("Hourly: 24 buckets",                lambda: None if len(hourly)==24 else (_ for _ in ()).throw(AssertionError(len(hourly))))
test("Hourly: all hours have rides",      lambda: None if all(h["rides"]>0 for h in hourly) else (_ for _ in ()).throw(AssertionError()))
peak_hour = max(hourly, key=lambda h: h["rides"])
test("Hourly: peak is 5–22h (daytime)",   lambda: None if 5 <= peak_hour["hour"] <= 22 else (_ for _ in ()).throw(AssertionError(peak_hour)))

zones = q("SELECT zone, COUNT(*) AS rides FROM rides GROUP BY zone ORDER BY rides DESC")
test("Zones: 10 unique zones",            lambda: None if len(zones)==10 else (_ for _ in ()).throw(AssertionError(len(zones))))
test("Zones: all zones have > 100 rides", lambda: None if all(z["rides"]>100 for z in zones) else (_ for _ in ()).throw(AssertionError()))

routes = q("SELECT pickup_zone||' → '||dropoff_zone AS route, COUNT(*) AS trips FROM rides GROUP BY pickup_zone, dropoff_zone ORDER BY trips DESC LIMIT 10")
test("Routes top-10: 10 results",         lambda: None if len(routes)==10 else (_ for _ in ()).throw(AssertionError(len(routes))))
test("Routes: top route has > 100 trips", lambda: None if routes[0]["trips"] > 100 else (_ for _ in ()).throw(AssertionError(routes[0]["trips"])))

# ── SECTION 5: Drivers endpoints ─────────────────────────────────────────────
print("\n👤 SECTION 5 — Drivers Endpoints")

drivers = q("""SELECT d.driver_id, d.name, COUNT(r.ride_id) AS rides, ROUND(SUM(r.fare),2) AS rev,
    ROUND(AVG(r.rating),2) AS rating,
    ROUND(100.0*SUM(CASE WHEN r.status='Completed' THEN 1 ELSE 0 END)/COUNT(*),1) AS comp
    FROM drivers d LEFT JOIN rides r ON r.driver_id=d.driver_id
    GROUP BY d.driver_id ORDER BY rides DESC LIMIT 20""")
test("Drivers: 20 results returned",                   lambda: None if len(drivers)==20 else (_ for _ in ()).throw(AssertionError(len(drivers))))
test("Drivers: top driver has > 100 rides",            lambda: None if drivers[0]["rides"]>100 else (_ for _ in ()).throw(AssertionError(drivers[0]["rides"])))
test("Drivers: all ratings in 3–5 range",              lambda: None if all(3.0 <= d["rating"] <= 5.0 for d in drivers if d["rating"]) else (_ for _ in ()).throw(AssertionError()))
test("Drivers: completion rates 80–100%",              lambda: None if all(80 <= d["comp"] <= 100 for d in drivers) else (_ for _ in ()).throw(AssertionError()))
test("Drivers: sum of driver rides covers all rides",  lambda: (
    lambda total: None if abs(total - kpis["total_rides"]) < kpis["total_rides"]*0.01 else (_ for _ in ()).throw(AssertionError(f"Sum {total} vs {kpis['total_rides']}"))
)(q("SELECT SUM(cnt) AS s FROM (SELECT COUNT(*) AS cnt FROM rides GROUP BY driver_id)", many=False)["s"])
)

# ── SECTION 6: Pagination / filtering ────────────────────────────────────────
print("\n🔍 SECTION 6 — Filtering & Pagination Logic")

def test_pagination():
    page, page_size = 2, 50
    offset = (page-1)*page_size
    rows = q("SELECT ride_id FROM rides ORDER BY pickup_dt DESC LIMIT ? OFFSET ?", (page_size, offset))
    assert len(rows) == page_size, f"Expected {page_size} rows, got {len(rows)}"
test("Pagination: page 2 of 50 returns 50 rows", test_pagination)

def test_year_filter():
    rows = q("SELECT COUNT(*) AS c FROM rides WHERE CAST(strftime('%Y',pickup_dt) AS INT) = 2013", many=False)
    assert rows["c"] > 500, f"Expected >500 rides in 2013, got {rows['c']}"
test("Year filter: 2013 returns > 500 rides", test_year_filter)

def test_zone_filter():
    rows = q("SELECT COUNT(*) AS c FROM rides WHERE zone = 'Airport'", many=False)
    assert rows["c"] > 100, f"Expected >100 Airport rides, got {rows['c']}"
test("Zone filter: Airport has > 100 rides", test_zone_filter)

def test_status_filter():
    completed = q("SELECT COUNT(*) AS c FROM rides WHERE status = 'Completed'", many=False)["c"]
    cancelled = q("SELECT COUNT(*) AS c FROM rides WHERE status = 'Cancelled'", many=False)["c"]
    assert completed > cancelled, "Completed should outnumber cancelled"
test("Status filter: Completed > Cancelled", test_status_filter)

def test_fare_range():
    rows = q("SELECT COUNT(*) AS c FROM rides WHERE fare BETWEEN 10 AND 20", many=False)
    assert rows["c"] > 0
test("Fare range filter: $10–$20 returns results", test_fare_range)

# ── SUMMARY ──────────────────────────────────────────────────────────────────
passed = sum(1 for _,ok,_ in results if ok)
failed = sum(1 for _,ok,_ in results if not ok)
total  = len(results)

print(f"\n{'═'*55}")
print(f"  RESULTS: {passed}/{total} passed  ·  {failed} failed")
if failed:
    print(f"\n  Failed tests:")
    for name, ok, err in results:
        if not ok:
            print(f"    {FAIL} {name}")
            print(f"       → {err}")
print(f"{'═'*55}\n")
sys.exit(0 if failed==0 else 1)
