import numpy as np
from functools import lru_cache
from sklearn.ensemble import IsolationForest

from app.services.monitoring import get_system_metrics


@lru_cache(maxsize=1)
def get_prediction_model():
    # Simulated normal baseline for initial model training
    rng = np.random.default_rng(42)

    training_data = np.column_stack([
        rng.uniform(10, 60, 500),
        rng.uniform(30, 80, 500),
        rng.uniform(10, 80, 500)
    ])

    model = IsolationForest(
        contamination=0.05,
        random_state=42
    )

    model.fit(training_data)
    return model


def predict_anomaly():
    metrics = get_system_metrics()
    model = get_prediction_model()

    current_data = [[
        metrics["cpu_usage"],
        metrics["memory_usage"],
        metrics["disk_usage"]
    ]]

    prediction = model.predict(current_data)[0]
    anomaly_score = float(model.decision_function(current_data)[0])

    is_anomaly = prediction == -1

    return {
        "agent": "AI Prediction Agent",
        "metrics": metrics,
        "prediction": "Anomaly Detected" if is_anomaly else "Normal",
        "anomaly_score": round(anomaly_score, 4),
        "status": "warning" if is_anomaly else "healthy",
        "model": "Isolation Forest",
        "training_samples": 500
    }
