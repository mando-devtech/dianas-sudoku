#!/usr/bin/env python3
"""
Diana's Sudoku - Python Server
Runs the Sudoku game locally.
Access from phone: use your computer's local IP address + :5000
"""

import json
import random
import copy
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

# Change to the directory containing this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Add PWA / modern MIME types
import mimetypes
mimetypes.add_type('application/manifest+json', '.json')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/png', '.png')


def get_local_ip():
    """Get local network IP for phone access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


class SudokuHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        if self.path == '/api/generate':
            self.handle_generate()
        elif self.path.startswith('/api/generate?'):
            self.handle_generate()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/generate':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body) if body else {}
            difficulty = data.get('difficulty', 'medium')
            puzzle, solution = generate_sudoku(difficulty)
            response = json.dumps({
                'puzzle': puzzle,
                'solution': solution,
                'difficulty': difficulty
            })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode())
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_generate(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        difficulty = params.get('difficulty', ['medium'])[0]
        puzzle, solution = generate_sudoku(difficulty)
        response = json.dumps({
            'puzzle': puzzle,
            'solution': solution,
            'difficulty': difficulty
        })
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response.encode())

    def log_message(self, format, *args):
        pass  # Suppress access logs for cleaner output


def is_valid(board, row, col, num):
    """Check if placing num at board[row][col] is valid."""
    # Check row
    if num in board[row]:
        return False
    # Check column
    if num in [board[r][col] for r in range(9)]:
        return False
    # Check 3x3 box
    box_row, box_col = 3 * (row // 3), 3 * (col // 3)
    for r in range(box_row, box_row + 3):
        for c in range(box_col, box_col + 3):
            if board[r][c] == num:
                return False
    return True


def solve(board):
    """Solve sudoku using backtracking. Returns True if solved."""
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                nums = list(range(1, 10))
                random.shuffle(nums)
                for num in nums:
                    if is_valid(board, row, col, num):
                        board[row][col] = num
                        if solve(board):
                            return True
                        board[row][col] = 0
                return False
    return True


def count_solutions(board, limit=2):
    """Count solutions up to limit using MRV heuristic."""
    best_row, best_col, best_cands = -1, -1, None
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                cands = [n for n in range(1, 10) if is_valid(board, r, c, n)]
                if not cands:
                    return 0
                if best_cands is None or len(cands) < len(best_cands):
                    best_cands = cands
                    best_row, best_col = r, c
                    if len(cands) == 1:
                        break
        if best_cands is not None and len(best_cands) == 1:
            break

    if best_row == -1:
        return 1

    count = 0
    for num in best_cands:
        board[best_row][best_col] = num
        count += count_solutions(board, limit - count)
        board[best_row][best_col] = 0
        if count >= limit:
            return count
    return count


def generate_sudoku(difficulty='medium'):
    """Generate a sudoku puzzle with a guaranteed unique solution."""
    # Generate a full solved board
    board = [[0] * 9 for _ in range(9)]
    solve(board)
    solution = copy.deepcopy(board)

    # Determine how many cells to remove
    remove_counts = {
        'easy': 36,
        'medium': 46,
        'hard': 56
    }
    cells_to_remove = remove_counts.get(difficulty, 46)

    # Remove cells while preserving unique solution
    puzzle = copy.deepcopy(board)
    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)

    removed = 0
    for row, col in cells:
        if removed >= cells_to_remove:
            break
        backup = puzzle[row][col]
        puzzle[row][col] = 0
        if count_solutions(copy.deepcopy(puzzle), 2) != 1:
            puzzle[row][col] = backup
        else:
            removed += 1

    return puzzle, solution


def main():
    port = 5000
    local_ip = get_local_ip()
    # Bind to 0.0.0.0 so phones on the same WiFi can connect
    server = HTTPServer(('0.0.0.0', port), SudokuHandler)
    print(f"\n🎮 Diana's Sudoku está corriendo!\n")
    print(f"   💻 En tu computadora: http://localhost:{port}")
    print(f"   📱 En tu celular:     http://{local_ip}:{port}")
    print(f"\n   Guarda http://{local_ip}:{port} en tu pantalla de inicio del iPhone")
    print(f"   para usarla como una app PWA.\n")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✅ Server stopped.")
        server.server_close()


if __name__ == '__main__':
    main()
