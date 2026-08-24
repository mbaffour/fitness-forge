#!/usr/bin/env python3
"""Dev-only static server that disables caching so edits show up on reload.

Not part of the app (the app itself is zero-build and ships as static files).
Serves the fitness-forge app root (the parent of this tools/ folder) regardless
of the current working directory.

Usage: python fitness-forge/tools/devserver.py [port]
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8797
    handler = partial(NoCacheHandler, directory=APP_ROOT)
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
