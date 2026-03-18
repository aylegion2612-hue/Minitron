"""
Minitron Cognee sidecar (Phase 5 minimal service).

Provides:
- GET /health
- POST /search  { "query": "..." }
- POST /graph   { "query": "..." }
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {"ok": True, "service": "cognee-sidecar"})
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            payload = json.loads(body)
        except Exception:
            self._json(400, {"error": "Invalid JSON"})
            return

        query = str(payload.get("query", "")).strip()
        if self.path == "/search":
            words = [w for w in query.split() if w]
            items = [
                {
                    "id": f"cg-{idx}",
                    "content": f"Cognee context for '{word}'",
                    "score": max(0.45, 0.95 - idx * 0.1),
                    "nodeType": "entity",
                }
                for idx, word in enumerate(words[:8], start=1)
            ]
            self._json(200, {"items": items})
            return

        if self.path == "/graph":
            words = [w for w in query.split() if w][:8]
            nodes = [{"id": f"n{idx}", "label": word} for idx, word in enumerate(words, start=1)]
            edges = []
            for idx in range(len(nodes) - 1):
                edges.append(
                    {
                        "from": nodes[idx]["id"],
                        "to": nodes[idx + 1]["id"],
                        "label": "related_to",
                    }
                )
            self._json(200, {"nodes": nodes, "edges": edges})
            return

        self._json(404, {"error": "Not found"})


def main() -> None:
    server = HTTPServer(("127.0.0.1", 7777), Handler)
    print("Cognee sidecar listening on http://127.0.0.1:7777")
    server.serve_forever()


if __name__ == "__main__":
    main()
