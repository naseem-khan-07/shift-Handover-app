from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).parent)
print('ShiftFlow demo: http://localhost:8090/demo.html')
ThreadingHTTPServer(('0.0.0.0',8090),SimpleHTTPRequestHandler).serve_forever()
