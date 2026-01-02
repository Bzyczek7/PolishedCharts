#!/usr/bin/env python3
"""
Script to start the TradingAlert backend server
"""
import uvicorn
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

# Add the app directory to the path so imports work correctly
sys.path.insert(0, str(Path(__file__).parent))

def main():
    print("Starting TradingAlert backend server...")
    print("Loading configuration...")

    # Import the main app here to ensure all dependencies are loaded
    try:
        from app.main import app
        print("Successfully loaded the application")
    except ImportError as e:
        print(f"Failed to import the application: {e}")
        sys.exit(1)

    print("Starting Uvicorn server on http://0.0.0.0:8000")

    # Run the server with the app object (not string) to preserve environment
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to False for production, True for development
        log_level="info"
    )

if __name__ == "__main__":
    main()