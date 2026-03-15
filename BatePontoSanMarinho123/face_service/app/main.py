from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.enroll import router as enroll_router
from app.routes.recognize import router as recognize_router

app = FastAPI()

origins = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "FaceAPI online"}

app.include_router(enroll_router)
app.include_router(recognize_router)
