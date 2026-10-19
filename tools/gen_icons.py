# -*- coding: utf-8 -*-
"""纯 Python 生成 tabBar 图标（无第三方依赖）"""
import zlib, struct, os, math

SS = 4  # 超采样倍数

def rrect(x0, y0, x1, y1, r):
    def f(x, y):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        cx = min(max(x, x0 + r), x1 - r)
        cy = min(max(y, y0 + r), y1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return f

def circle(cx, cy, r):
    return lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def ring(cx, cy, r, w):
    return lambda x, y: r - w <= math.hypot(x - cx, y - cy) <= r

def stroke(outer, inner):
    return lambda x, y: outer(x, y) and not inner(x, y)

def union(*fns):
    return lambda x, y: any(f(x, y) for f in fns)

def subtract(a, b):
    return lambda x, y: a(x, y) and not b(x, y)

def render(size, shapes, rgb):
    N = size * SS
    grid = bytearray(N * N)
    for y in range(N):
        yy = (y + 0.5) / SS
        row = y * N
        for x in range(N):
            xx = (x + 0.5) / SS
            for f in shapes:
                if f(xx, yy):
                    grid[row + x] = 1
                    break
    # 降采样
    out = bytearray()
    r, g, b = rgb
    for y in range(size):
        out.append(0)  # filter type 0
        for x in range(size):
            tot = 0
            for dy in range(SS):
                base = (y * SS + dy) * N + x * SS
                for dx in range(SS):
                    tot += grid[base + dx]
            a = int(tot * 255 / (SS * SS))
            out += bytes((r, g, b, a))
    return out

def write_png(path, size, raw):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
           chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)

S = 81
NORM = (0x8B, 0x8B, 0x80)
ON = (0x5C, 0x71, 0x51)

# ---- 衣橱：柜体 + 中缝 + 两个把手 ----
def closet():
    outer = rrect(11, 9, 70, 73, 8)
    inner = rrect(16.5, 14.5, 64.5, 67.5, 4)
    body = stroke(outer, inner)
    divider = lambda x, y: 38.5 <= x <= 42.5 and 10 <= y <= 72
    h1 = rrect(24, 38, 28, 48, 2)
    h2 = rrect(53, 38, 57, 48, 2)
    return union(body, divider, h1, h2)

# ---- 我的：头 + 肩 ----
def person():
    head = circle(40.5, 26, 13)
    head_ring = stroke(circle(40.5, 26, 13), circle(40.5, 26, 8.5))
    shoulders = subtract(rrect(14, 44, 67, 76, 16), rrect(19.5, 49.5, 61.5, 80, 11))
    return union(head_ring, shoulders)

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'miniprogram', 'images')
os.makedirs(out_dir, exist_ok=True)

for name, fn in (('tab-closet', closet()), ('tab-mine', person())):
    write_png(os.path.join(out_dir, name + '.png'), S, render(S, [fn], NORM))
    write_png(os.path.join(out_dir, name + '-on.png'), S, render(S, [fn], ON))
    print('generated', name)
