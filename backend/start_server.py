#!/usr/bin/env python3
"""
Script to start the TradingAlert backend server
"""
import uvicorn
import sys
import os
from pathlib import Path

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
    
    # Run the server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to False for production, True for development
        log_level="info"
    )

if __name__ == "__main__":
    main()