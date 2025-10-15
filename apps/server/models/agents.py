from pydantic import BaseModel


class CleanupAgentsResponse(BaseModel):
    """Response model for agent cleanup endpoint."""

    success: bool
    message: str
    users_processed: int
    agents_cleared: int
    logs_cleared: int
    memory_cleared: int
