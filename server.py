"""Conspyramid local server: serves the game on your Wi-Fi and relays online matches between two devices.

Run:  python server.py        then open the address it prints.
Anyone on the same Wi-Fi can open that address too. No internet needed.
"""
import json, os, socket, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
rooms = {}            # room code -> {'host': [msgs], 'guest': [msgs], 'seen': time}
lock = threading.Condition()


def lan_ip():
    try:   # no packet is sent; this just asks which network card would be used
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('10.255.255.255', 1)); ip = s.getsockname()[0]; s.close()
        return ip
    except OSError:
        return socket.gethostbyname(socket.gethostname())


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a): pass   # keep the console quiet

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')   # always load the newest game files
        super().end_headers()

    def reply(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == '/net/info':
            return self.reply({'base': f'http://{lan_ip()}:{PORT}/'})
        if u.path == '/net/recv':   # long-poll: wait up to 10s for messages addressed to me
            room, me = q.get('room', ''), q.get('me', '')
            if me not in ('host', 'guest'): return self.reply({'error': 'bad me'}, 400)
            end = time.time() + 10
            with lock:
                r = rooms.setdefault(room, {'host': [], 'guest': [], 'seen': 0})
                while not r[me] and time.time() < end: lock.wait(end - time.time())
                msgs, r[me] = r[me], []
                r['seen'] = time.time()
            return self.reply(msgs)
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path != '/net/send': return self.reply({'error': 'not found'}, 404)
        room, to = q.get('room', ''), q.get('to', '')
        if to not in ('host', 'guest'): return self.reply({'error': 'bad to'}, 400)
        msg = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or 'null')
        with lock:
            r = rooms.setdefault(room, {'host': [], 'guest': [], 'seen': time.time()})
            r[to].append(msg)
            if len(r[to]) > 300: del r[to][:-300]   # nobody listening: don't pile up forever
            for k in [k for k, v in rooms.items() if time.time() - v['seen'] > 600]: del rooms[k]
            lock.notify_all()
        self.reply({'ok': True})


if __name__ == '__main__':
    print(f'Conspyramid is running!\n  On this computer:      http://localhost:{PORT}/\n  On the same Wi-Fi:     http://{lan_ip()}:{PORT}/\nPress Ctrl+C to stop.')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
