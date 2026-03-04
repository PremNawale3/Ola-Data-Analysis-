"""
OLA Analytics — Seed Script
Generates 10,000+ realistic ride records + 50 drivers into ola.db
Run: python seed.py
"""

import sqlite3, random, math, os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "ola.db")
TOTAL_RIDES = 10_500
SEED = 42
random.seed(SEED)

# ─── SCHEMA ──────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS drivers (
    driver_id       TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    zone            TEXT NOT NULL,
    joined_dt       TEXT NOT NULL,
    trend_pct       REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rides (
    ride_id         TEXT PRIMARY KEY,
    driver_id       TEXT NOT NULL,
    pickup_dt       TEXT NOT NULL,
    fare            REAL NOT NULL,
    distance        REAL NOT NULL,
    passenger_count INTEGER NOT NULL,
    zone            TEXT NOT NULL,
    pickup_zone     TEXT NOT NULL,
    dropoff_zone    TEXT NOT NULL,
    status          TEXT NOT NULL,
    rating          REAL,
    pickup_lat      REAL,
    pickup_lon      REAL,
    dropoff_lat     REAL,
    dropoff_lon     REAL,
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

CREATE INDEX IF NOT EXISTS idx_rides_dt     ON rides(pickup_dt);
CREATE INDEX IF NOT EXISTS idx_rides_zone   ON rides(zone);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_fare   ON rides(fare);
"""

# ─── REFERENCE DATA ──────────────────────────────────────────────────────────

ZONES = ["Downtown", "Airport", "Suburbs", "CBD", "Midtown",
         "Uptown", "Harbor", "Station", "University", "Industrial"]

ZONE_COORDS = {
    "Downtown":   (12.9716, 77.5946),
    "Airport":    (13.1986, 77.7066),
    "Suburbs":    (12.9100, 77.5800),
    "CBD":        (12.9754, 77.6032),
    "Midtown":    (12.9900, 77.6100),
    "Uptown":     (13.0100, 77.5700),
    "Harbor":     (12.9500, 77.6400),
    "Station":    (12.9775, 77.5713),
    "University": (13.0200, 77.5600),
    "Industrial": (12.9200, 77.6700),
}

FIRST_NAMES = ["Arjun","Priya","Ravi","Neha","Suresh","Divya","Manoj","Anjali",
               "Kiran","Deepa","Sanjay","Pooja","Vikram","Lakshmi","Rahul","Meera",
               "Arun","Kavya","Rajesh","Sunita","Nitin","Shreya","Amit","Nandini",
               "Varun","Pallavi","Rohan","Swati","Sachin","Bhavna"]
LAST_NAMES  = ["Sharma","Patel","Kumar","Singh","Reddy","Nair","Mehta","Iyer",
               "Joshi","Verma","Gupta","Shah","Rao","Malhotra","Pillai","Bose"]

STATUSES    = ["Completed"] * 85 + ["Late"] * 10 + ["Cancelled"] * 5

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return round(R * 2 * math.asin(math.sqrt(max(0, a))), 2)

def jitter(lat, lon, km=2):
    offset = km / 111
    return (
        lat + random.uniform(-offset, offset),
        lon + random.uniform(-offset, offset),
    )

def random_dt():
    # Weighted towards 2012-2015 (more data density)
    year  = random.choices(range(2009, 2016), weights=[8,9,10,13,14,13,6])[0]
    month = random.randint(1, 12)
    day   = random.randint(1, 28)
    # Peak hours: 7-10am, 5-9pm
    hour  = random.choices(range(24), weights=[
        3,2,1,1,1,2, 6,9,9,7, 6,6, 7,7,6,6, 8,10,10,9, 8,7,5,4
    ])[0]
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime(year, month, day, hour, minute, second)

def compute_fare(distance, pax, hour, status):
    base      = 2.5
    per_km    = 1.8
    pax_surcharge = 0.3 * (pax - 1)
    peak_mult = 1.3 if hour in range(7,10) or hour in range(17,21) else 1.0
    fare = (base + per_km * distance + pax_surcharge) * peak_mult
    fare *= random.uniform(0.9, 1.15)   # slight noise
    if status == "Cancelled":
        fare = round(random.uniform(0, 2), 2)   # cancellation fee
    return round(max(0.5, fare), 2)

# ─── GENERATE ────────────────────────────────────────────────────────────────

def generate_drivers(n=50):
    drivers = []
    for i in range(n):
        zone = random.choice(ZONES)
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        joined = datetime(2008, 1, 1) + timedelta(days=random.randint(0, 2000))
        trend  = round(random.uniform(-15, 25), 1)
        drivers.append((
            f"DRV-{1001+i}", name, zone,
            joined.strftime("%Y-%m-%d"), trend
        ))
    return drivers

def generate_rides(drivers, n=TOTAL_RIDES):
    driver_ids = [d[0] for d in drivers]
    rides = []
    for i in range(n):
        driver_id  = random.choice(driver_ids)
        pickup_zone  = random.choice(ZONES)
        dropoff_zone = random.choice([z for z in ZONES if z != pickup_zone])
        plat, plon = jitter(*ZONE_COORDS[pickup_zone])
        dlat, dlon = jitter(*ZONE_COORDS[dropoff_zone])
        dist  = max(0.5, haversine(plat, plon, dlat, dlon))
        dt    = random_dt()
        pax   = random.choices([1,2,3,4,5,6], weights=[60,18,7,3,9,3])[0]
        status = random.choice(STATUSES)
        fare  = compute_fare(dist, pax, dt.hour, status)
        rating = None if status == "Cancelled" else round(random.uniform(3.5, 5.0), 1)

        rides.append((
            f"OLA-{100000+i}",
            driver_id,
            dt.strftime("%Y-%m-%d %H:%M:%S"),
            fare, round(dist, 2), pax,
            pickup_zone,
            pickup_zone, dropoff_zone,
            status, rating,
            round(plat,6), round(plon,6),
            round(dlat,6), round(dlon,6),
        ))
    return rides

# ─── MAIN ────────────────────────────────────────────────────────────────────

def seed():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"🗑  Removed existing {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    print("👥  Generating 50 drivers...")
    drivers = generate_drivers(50)
    conn.executemany(
        "INSERT INTO drivers VALUES (?,?,?,?,?)", drivers
    )

    print(f"🚗  Generating {TOTAL_RIDES:,} rides...")
    rides = generate_rides(drivers, TOTAL_RIDES)
    conn.executemany(
        "INSERT INTO rides VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rides
    )

    conn.commit()

    # Summary
    cur = conn.execute("SELECT COUNT(*) FROM rides")
    print(f"✅  Seeded {cur.fetchone()[0]:,} rides")
    cur = conn.execute("SELECT COUNT(*) FROM drivers")
    print(f"✅  Seeded {cur.fetchone()[0]:,} drivers")
    cur = conn.execute("SELECT ROUND(SUM(fare),2) FROM rides")
    print(f"✅  Total revenue: ${cur.fetchone()[0]:,.2f}")
    conn.close()
    print(f"\n📦  Database ready at: {DB_PATH}")

if __name__ == "__main__":
    seed()
