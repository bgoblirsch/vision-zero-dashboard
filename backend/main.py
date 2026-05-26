from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import cities, crashes

app = FastAPI(title="Vision Zero API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(crashes.router)
app.include_router(cities.router)

@app.get("/health")
def health():
    return {"status": "ok"}