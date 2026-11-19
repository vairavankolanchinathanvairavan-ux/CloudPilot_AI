from fastapi import APIRouter
from app.agents.prediction_agent import predict_anomaly

router = APIRouter(
    prefix="/api/prediction",
    tags=["AI Prediction"]
)


@router.get("/anomaly")
def detect_anomaly():
    return predict_anomaly()
