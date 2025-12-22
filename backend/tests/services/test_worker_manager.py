import pytest
import asyncio
from app.services.worker_manager import WorkerManager

@pytest.mark.asyncio
async def test_worker_manager_starts_and_tracks_task():
    manager = WorkerManager()
    
    async def dummy_task():
        await asyncio.sleep(0.1)
        return "done"
        
    task = manager.start_task("test_task", dummy_task())
    assert manager.active_task_count == 1
    assert manager.is_task_running("test_task")
    
    await task
    # Done callback might take a micro-tick to run
    await asyncio.sleep(0.01)
    assert manager.active_task_count == 0

@pytest.mark.asyncio
async def test_worker_manager_cancels_duplicate_named_task():
    manager = WorkerManager()
    
    async def long_task():
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            pass
        
    task1 = manager.start_task("same_name", long_task())
    task2 = manager.start_task("same_name", long_task())
    
    # Allow loop to process cancellation
    await asyncio.sleep(0)
    
    # In some asyncio versions, task.cancelled() only becomes true AFTER it actually yields while cancelling
    # But it should be requested to cancel.
    assert task1.done() # Should be done because it was cancelled
    
    assert manager.active_task_count == 1
    
    await manager.stop_all()

@pytest.mark.asyncio
async def test_worker_manager_stop_all():
    manager = WorkerManager()
    
    async def infinite_task():
        try:
            while True:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            return
            
    manager.start_task("inf1", infinite_task())
    manager.start_task("inf2", infinite_task())
    assert manager.active_task_count == 2
    
    await manager.stop_all()
    assert manager.active_task_count == 0