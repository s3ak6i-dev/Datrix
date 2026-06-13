"""
Datrix backend launcher.

Sets WindowsSelectorEventLoopPolicy before uvicorn creates its event loop.
ProactorEventLoop (Windows default) hangs after psycopg2 uses IOCP handles.
"""
import sys

if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload="--reload" in sys.argv,
    )
