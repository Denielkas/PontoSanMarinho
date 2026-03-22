import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.enroll import router as enroll_router
from app.routes.recognize import router as recognize_router
from app.database import garantir_tabela_face

app = FastAPI()

origins_env = os.getenv("ALLOW_ORIGINS", "")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]

if not origins:
    origins = [
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    garantir_tabela_face()

@app.get("/")
def root():
    return {"status": "FaceAPI online"}

app.include_router(enroll_router)
app.include_router(recognize_router)