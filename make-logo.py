# -*- coding: utf-8 -*-
"""
Xuất logo gọn từ 'logo-full.png':
  - logo-emblem.png : CHỈ biểu tượng thuyền (không chữ) — dùng cho nav góc trên-trái
  - logo-mark.png   : biểu tượng + 'DHT' ghép lại (bỏ dòng 'CÔNG TY...' đã sai và slogan)
Nền trắng -> trong suốt, mép mềm, giữ độ phân giải cao -> nét.
"""
import os, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
img = Image.open(os.path.join(HERE, "logo-full.png")).convert("RGBA")
W, H = img.size
a = np.array(img).astype(int)
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)

# Xóa nền trắng, mép mềm
alpha = a[:, :, 3].copy()
white = (r > 238) & (g > 238) & (b > 238)
soft = (~white) & (r > 210) & (g > 210) & (b > 210)
alpha[white] = 0
alpha[soft] = ((255 - mx) / 45.0 * 255).clip(0, 255).astype(int)[soft]
a[:, :, 3] = alpha
rgba = a.astype("uint8")

def trim_h(im):
    """Cắt khoảng trắng hai bên + trên/dưới của một ảnh RGBA."""
    arr = np.array(im)
    m = arr[:, :, 3] > 20
    if not m.any():
        return im
    xs = np.where(m.any(axis=0))[0]; ys = np.where(m.any(axis=1))[0]
    return im.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))

# Tỉ lệ theo ảnh (an toàn nếu đổi kích thước nguồn)
def band(y0, y1):
    return Image.fromarray(rgba[int(y0):int(y1)])

EMBLEM = trim_h(band(0.140 * H, 0.500 * H))     # ~148..512
DHT    = trim_h(band(0.548 * H, 0.690 * H))     # ~561..706

EMBLEM.save(os.path.join(HERE, "logo-emblem.png"))
print("logo-emblem.png", EMBLEM.size)

# Ghép biểu tượng + DHT, căn giữa, nền trong suốt
gap = int(0.03 * H)
cw = max(EMBLEM.width, DHT.width)
ch = EMBLEM.height + gap + DHT.height
canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
canvas.paste(EMBLEM, ((cw - EMBLEM.width) // 2, 0), EMBLEM)
canvas.paste(DHT, ((cw - DHT.width) // 2, EMBLEM.height + gap), DHT)
canvas = trim_h(canvas)
canvas.save(os.path.join(HERE, "logo-mark.png"))
print("logo-mark.png", canvas.size)
print("Xong.")
