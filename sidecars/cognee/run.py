from cognee.api.v1.cognify.cognify import cognify  # noqa: F401
from cognee.infrastructure.databases.vector import get_vectordb_config  # noqa: F401
import cognee
import asyncio  # noqa: F401
import sys
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("cognee")


@mcp.tool()
async def add_memory(content: str, session_id: str = "default"):
    await cognee.add(content, dataset_name=session_id)
    await cognee.cognify()
    return {"status": "stored"}


@mcp.tool()
async def search_memory(query: str):
    results = await cognee.search(query)
    return {"results": [str(r) for r in results]}


@mcp.tool()
async def reset_memory():
    await cognee.prune.prune_data()
    await cognee.prune.prune_system()
    return {"status": "reset"}


if __name__ == "__main__":
    if "--help" in sys.argv or "-h" in sys.argv:
        print("usage: python sidecars/cognee/run.py [--help]")
        print("Starts Cognee MCP sidecar over stdio transport.")
        raise SystemExit(0)
    mcp.run(transport="stdio")
