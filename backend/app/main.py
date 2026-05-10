"""FastAPI entry point for Space Mission Control API."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_pool
from .routers import auth, missions, satellites, telemetry, anomalies, ground_stations, dashboard, reports

app = FastAPI(
    title="Space Mission Control API",
    description="Backend API for managing space missions, satellites, telemetry, and anomalies.",
    version="1.0.0",
)

# CORS - allow Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Oracle connection pool on startup
@app.on_event("startup")
async def startup():
    init_pool()

# Include all routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(missions.router, prefix="/api/v1")
app.include_router(satellites.router, prefix="/api/v1")
app.include_router(telemetry.router, prefix="/api/v1")
app.include_router(anomalies.router, prefix="/api/v1")
app.include_router(ground_stations.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Space Mission Control API", "version": "1.0.0", "docs": "/docs"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}