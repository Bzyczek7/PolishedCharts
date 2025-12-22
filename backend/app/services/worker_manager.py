import asyncio
import logging
from typing import Dict, Set, Optional, Callable
from concurrent.futures import Future

logger = logging.getLogger(__name__)

class WorkerManager:
    """
    Manages the lifecycle of background worker tasks.
    Tracks active tasks, handles their completion, and ensures graceful shutdown.
    """
    def __init__(self):
        self._tasks: Dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()

    def start_task(self, name: str, coro) -> asyncio.Task:
        """
        Start a named background task.
        If a task with the same name exists, it will be cancelled if not done.
        """
        if name in self._tasks and not self._tasks[name].done():
            logger.warning(f"Task '{name}' is already running. Cancelling existing task.")
            self._tasks[name].cancel()

        task = asyncio.create_task(coro, name=name)
        self._tasks[name] = task
        
        # Add cleanup callback
        task.add_done_callback(lambda t: self._task_done_callback(name, t))
        return task

    def _task_done_callback(self, name: str, task: asyncio.Task):
        """
        Internal callback to clean up the task map when a task completes.
        """
        try:
            # Pop the task from our tracking map
            self._tasks.pop(name, None)
            
            if task.cancelled():
                logger.info(f"Task '{name}' was cancelled.")
            elif task.exception():
                logger.error(f"Task '{name}' failed with error: {task.exception()}", exc_info=task.exception())
            else:
                logger.info(f"Task '{name}' completed successfully.")
        except Exception as e:
            logger.error(f"Error in task done callback for '{name}': {e}")

    async def stop_all(self, timeout: float = 5.0):
        """
        Stop all running tasks gracefully.
        """
        self._shutdown_event.set()
        
        if not self._tasks:
            return

        active_tasks = list(self._tasks.values())
        logger.info(f"Shutting down {len(active_tasks)} background tasks...")
        
        for task in active_tasks:
            task.cancel()
            
        # Wait for tasks to acknowledge cancellation
        try:
            await asyncio.wait(active_tasks, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Shutdown timed out. Some tasks may still be running.")
            
        remaining = [t for t in active_tasks if not t.done()]
        if remaining:
            logger.warning(f"{len(remaining)} tasks failed to exit gracefully.")
        else:
            logger.info("All tasks stopped.")

    @property
    def active_task_count(self) -> int:
        return len(self._tasks)

    def is_task_running(self, name: str) -> bool:
        return name in self._tasks and not self._tasks[name].done()
