# OLA Analytics Dashboard — Full Stack

## Stack
- **Backend**: FastAPI + SQLite (via `sqlite3` stdlib, no ORM needed)
- **Frontend**: React + Recharts + Tailwind-compatible inline styles
- **Data**: 10,500 seeded rides · 50 drivers · 2009–2015

## Quick Start

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python seed.py          # generates ola.db with 10,500 rides
uvicorn main:app --reload --port 8000
# API docs → http://localhost:8000/docs
```

### 2. Frontend
```bash
# Add OlaDashboard.jsx to your React project
# Set USE_MOCK = false in OlaDashboard.jsx to connect live API
# Uses: recharts (already in your project)
```

### 3. Run Tests
```bash
cd backend
python test_backend.py   # 41 tests — 6 sections
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | DB health check |
| GET | /api/kpis | Aggregate KPIs (filterable by year) |
| GET | /api/revenue/yearly | Revenue by year |
| GET | /api/revenue/monthly | Revenue by month (filter by year) |
| GET | /api/revenue/by-pax | Revenue by passenger count |
| GET | /api/revenue/fare-distribution | Fare bracket counts |
| GET | /api/rides/hourly | Rides per hour |
| GET | /api/rides/by-zone | Rides per zone |
| GET | /api/rides/status-breakdown | Status counts |
| GET | /api/drivers | Driver leaderboard (sortable, paginated) |
| GET | /api/drivers/{id} | Driver detail + monthly stats |
| GET | /api/routes/top | Top routes by trip volume |
| GET | /api/rides | Paginated raw rides (filter: year, zone, status, fare range, search) |

## Dashboard Pages
1. **Overview** — KPI cards, annual bar+line, fare distribution, hourly heatmap
2. **Revenue** — Monthly trend, pax donut, avg fare YoY, revenue highlights
3. **Bookings** — Hourly demand, zone map, pax mix, top routes
4. **Drivers** — Leaderboard, completion rates, performance matrix
5. **Raw Data** — Virtualized table (10K rows), sortable, searchable, drill-through modal

## Features
- Year slicer filters KPIs and charts globally
- Drill-through modal on every raw data row
- Interactive zone map with active state
- Virtualized scrolling (renders only visible rows)
- Sidebar collapsible nav
- All fonts: Barlow Condensed + DM Sans + JetBrains Mono
- Theme: Zinc-950 + #D7DF23 neon green
