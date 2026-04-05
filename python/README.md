Python Analytics Integration

This folder contains Python scripts used by the NestJS backend for analytics.

Current script:
- ai_analytics.py: computes highest category, lowest category, and products that reached stock limit.

Backend endpoint:
- POST /analytics/assistant (JWT required)

Request body example:
{
  "query": "what is the lowest category and products that reached limit"
}

Response fields:
- data.highestCategory
- data.lowestCategory
- data.productsReachedLimit
- data.answer

Python runtime options:
1. Ensure python is available in PATH as python or py.
2. Or set environment variable PYTHON_BIN to your Python executable.
