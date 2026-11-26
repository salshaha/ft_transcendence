
# Use Python 3.11
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Prevent Python from creating unnecessary cache files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Flask backend into the container
COPY . .

# Flask listens on port 5000
EXPOSE 5000

# Start Flask and make it accessible outside the container
CMD ["python", "-m", "flask", "--app", "run", "run", "--host=0.0.0.0", "--port=5000"]
