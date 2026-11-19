from pydantic import BaseModel, Field

class SystemMetrics(BaseModel):
    timestamp: str
    cpu_usage: float = Field(ge=0, le=100)
    memory_usage: float = Field(ge=0, le=100)
    disk_usage: float = Field(ge=0, le=100)
    status: str
