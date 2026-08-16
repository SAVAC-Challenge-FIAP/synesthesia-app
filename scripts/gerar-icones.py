#!/usr/bin/env python3
"""
Gera os PNGs da marca a partir da geometria do símbolo (T069).

Por que desenhar em vez de converter o SVG: esta máquina não tem
`rsvg-convert`, `inkscape`, ImageMagick, `cairosvg` nem `sharp`. O símbolo,
porém, é geometria pura — três anéis concêntricos, um miolo e quatro marcas nos
eixos —, então rasterizar direto sai exato, com transparência real e no tamanho
pedido, sem instalar nada.

As proporções vêm do nó 728:143 do Figma (28×28), normalizadas para fração do
lado, e batem com `assets/icon.svg`.

Uso:  python3 scripts/gerar-icones.py
"""

import math
import struct
import zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ASSETS = RAIZ / 'assets'

# Paleta — tokens do projeto (src/theme/tokens.ts)
AMBER = (0xF8, 0xA2, 0x0D)
RUBY = (0x8D, 0x15, 0x14)
PARCHMENT = (0xF5, 0xEE, 0xDE)
INK = (0x09, 0x05, 0x06)

# Geometria normalizada (fração do lado), do Figma 28×28
R_ANEL_EXTERNO = 12.6875 / 28
W_ANEL_EXTERNO = 1.225 / 28
R_ANEL_MEDIO = 7.875 / 28
W_ANEL_MEDIO = 0.875 / 28
R_MIOLO = 2.8 / 28
R_PONTO = 0.7 / 28
OFF_PONTO = (14 - 12.775) / 28  # deslocamento do ponto em relação ao centro
TICK_DE = 10.9375 / 28
TICK_ATE = 13.5625 / 28
W_TICK = 0.875 / 28

SUPER = 4  # supersampling: 4×4 amostras por pixel


def _mistura(base, cor, alfa):
    return tuple(round(base[i] * (1 - alfa) + cor[i] * alfa) for i in range(3))


def desenhar(lado, fundo=None, escala_marca=1.0, mono=None):
    """
    Devolve (pixels RGBA, lado). `fundo=None` → transparente.
    `escala_marca` < 1 encolhe o desenho (adaptive icon do Android corta bordas).
    `mono` força uma cor única para toda a marca (ícone monocromático).
    """
    n = lado
    # canais em float para acumular o supersampling
    buf = [[(0, 0, 0, 0.0) for _ in range(n)] for _ in range(n)]
    centro = n / 2

    def cor_de(camada):
        if mono is not None:
            return mono
        return camada

    # raios em pixels
    e = escala_marca * n
    r_ext, w_ext = R_ANEL_EXTERNO * e, W_ANEL_EXTERNO * e
    r_med, w_med = R_ANEL_MEDIO * e, W_ANEL_MEDIO * e
    r_mio = R_MIOLO * e
    r_pon = R_PONTO * e
    off = OFF_PONTO * e
    t_de, t_ate, w_t = TICK_DE * e, TICK_ATE * e, W_TICK * e

    passo = 1.0 / SUPER
    for y in range(n):
        for x in range(n):
            acc_r = acc_g = acc_b = 0.0
            acc_a = 0.0
            for sy in range(SUPER):
                for sx in range(SUPER):
                    px = x + (sx + 0.5) * passo - centro
                    py = y + (sy + 0.5) * passo - centro
                    d = math.hypot(px, py)

                    cor = None
                    alfa = 0.0
                    # ponto claro (mais interno, desenhado por último no SVG)
                    if math.hypot(px + off, py + off) <= r_pon:
                        cor, alfa = cor_de(PARCHMENT), 0.9
                    elif d <= r_mio:
                        cor, alfa = cor_de(RUBY), 1.0
                    elif abs(d - r_med) <= w_med / 2:
                        cor, alfa = cor_de(AMBER), 1.0
                    elif abs(d - r_ext) <= w_ext / 2:
                        cor, alfa = cor_de(AMBER), 1.0
                    elif t_de <= d <= t_ate and (abs(px) <= w_t / 2 or abs(py) <= w_t / 2):
                        cor, alfa = cor_de(AMBER), 1.0

                    if cor is not None:
                        acc_r += cor[0] * alfa
                        acc_g += cor[1] * alfa
                        acc_b += cor[2] * alfa
                        acc_a += alfa
            total = SUPER * SUPER
            a = acc_a / total
            if a > 0:
                cor_media = (acc_r / acc_a, acc_g / acc_a, acc_b / acc_a)
            else:
                cor_media = (0, 0, 0)
            buf[y][x] = (cor_media[0], cor_media[1], cor_media[2], a)

    # compõe sobre o fundo (ou mantém alfa)
    linhas = bytearray()
    for y in range(n):
        linhas.append(0)  # filtro None
        for x in range(n):
            r, g, b, a = buf[y][x]
            if fundo is not None:
                rgb = _mistura(fundo, (r, g, b), a)
                linhas += bytes((rgb[0], rgb[1], rgb[2], 255))
            else:
                linhas += bytes((round(r), round(g), round(b), round(a * 255)))
    return bytes(linhas), n


def escrever_png(caminho, dados, lado):
    def bloco(tipo, corpo):
        c = tipo + corpo
        return struct.pack('>I', len(corpo)) + c + struct.pack('>I', zlib.crc32(c))

    png = b'\x89PNG\r\n\x1a\n'
    png += bloco(b'IHDR', struct.pack('>IIBBBBB', lado, lado, 8, 6, 0, 0, 0))
    png += bloco(b'IDAT', zlib.compress(dados, 9))
    png += bloco(b'IEND', b'')
    caminho.write_bytes(png)
    print(f'  {caminho.relative_to(RAIZ)}  ({lado}×{lado}, {len(png):,} bytes)')


def main():
    print('Gerando ícones da marca:')

    # Ícone do app: 1024, SEM transparência e SEM cantos arredondados —
    # o sistema arredonda sozinho; vir arredondado arredondaria duas vezes.
    escrever_png(ASSETS / 'icon.png', *desenhar(1024, fundo=INK, escala_marca=0.72))

    # Adaptive icon do Android. O `foreground` precisa do desenho dentro dos
    # ~66% centrais, porque cada fabricante recorta uma forma diferente.
    escrever_png(ASSETS / 'android-icon-foreground.png', *desenhar(1024, escala_marca=0.46))
    escrever_png(ASSETS / 'android-icon-background.png', *desenhar(1024, fundo=INK, escala_marca=0.0))
    escrever_png(
        ASSETS / 'android-icon-monochrome.png',
        *desenhar(1024, escala_marca=0.46, mono=(255, 255, 255)),
    )

    # Splash: transparente, só a marca — o fundo vem do backgroundColor.
    escrever_png(ASSETS / 'splash-icon.png', *desenhar(1024, escala_marca=0.55))

    # Favicon web nos dois tamanhos, para não depender de reescala borrada.
    escrever_png(ASSETS / 'favicon.png', *desenhar(196, fundo=INK, escala_marca=0.72))
    escrever_png(ASSETS / 'favicon-48.png', *desenhar(48, fundo=INK, escala_marca=0.72))


if __name__ == '__main__':
    main()
