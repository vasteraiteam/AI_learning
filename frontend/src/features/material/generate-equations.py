"""Generate the fixed, three-page mock handout using a local Chinese TrueType font."""

import os
import sys
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


INK = HexColor('#24263d')
MUTED = HexColor('#5e6880')
VIOLET = HexColor('#6847cb')
LINE = HexColor('#ebe7f4')
LAVENDER = HexColor('#f7f3ff')
W, H = 612, 792


def generate(output, font):
    pdfmetrics.registerFont(TTFont('Handout', str(font)))
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output), pagesize=(W, H), pageCompression=True, invariant=True)
    pdf.setTitle('第 3 章 · 一元一次方程')
    pdf.setAuthor('爱学纪')

    def label(x, y, value, size=14, color=INK, face='Handout'):
        pdf.setFont(face, size)
        pdf.setFillColor(color)
        pdf.drawString(x, y, value)

    def rule(y):
        pdf.setStrokeColor(LINE)
        pdf.line(48, y, 564, y)

    def head(name, caption):
        label(48, 734, '七年级数学  /  第 3 章 一元一次方程', 12, VIOLET)
        label(48, 684, name, 32)
        label(48, 651, caption, 13, MUTED)
        rule(624)

    def note(left, top, title, rows):
        label(left, top, title, 17)
        for index, row in enumerate(rows):
            label(left, top - 31 - index * 25, row, 13, MUTED)

    def exercise(y, title, prompt, equation, shaded=False):
        pdf.setFillColor(LAVENDER if shaded else HexColor('#ffffff'))
        pdf.setStrokeColor(LINE)
        pdf.roundRect(46, y, 520, 128, 5, fill=1, stroke=1)
        label(65, y + 100, title, 13, VIOLET)
        label(65, y + 75, prompt, 12, MUTED)
        label(65, y + 32, equation, 25, INK)

    def finish(page):
        rule(58)
        label(48, 35, '爱学纪  ·  课堂讲义', 11, MUTED)
        label(503, 35, f'{page:02d} / 03', 11, MUTED)
        pdf.showPage()

    head('知识回顾', '认识方程与等式的性质')
    note(48, 574, '什么是一元一次方程？', [
        '只含有一个未知数，且未知数的最高次数是 1 的整式方程。',
        '例如：2x + 3 = 9。解方程，就是找到使等式成立的未知数的值。',
    ])
    rule(457)
    note(48, 417, '等式的性质', [
        '等式两边同时加上或减去同一个数，等式仍然成立。',
        '等式两边同时乘或除以同一个非零数，等式仍然成立。',
    ])
    rule(300)
    note(48, 260, '想一想', [
        '当 x 的系数不是 1 时，可以如何把它化成 1？',
    ])
    finish(1)

    head('例题精讲', '用等式的性质一步步解方程')
    exercise(456, '例题 02', '解下列一元一次方程：', '3(x - 2) = 12', shaded=True)
    note(48, 404, '思考方向', [
        '括号外的系数是几？观察等式两边，想想怎样使左边更简单。',
        '每做一步，都说明等式两边进行了怎样相同的运算。',
    ])
    rule(290)
    note(48, 248, '检验你的解', [
        '把求出的未知数代回原方程，看左右两边是否相等。',
    ])
    finish(2)

    head('巩固练习', '选一种思路解方程，并说出每一步的依据')
    exercise(456, '练习 01', '先观察括号外的系数：', '4(x - 1) = 20')
    exercise(308, '练习 02', '试着先把常数项移到右边：', '2x + 7 = 15')
    note(48, 246, '自我检查', [
        '每一步是否保持等式成立？',
        '最终的解代回原方程之后，左右两边相等吗？',
    ])
    finish(3)
    pdf.save()


if __name__ == '__main__':
    project_root = Path(__file__).resolve().parents[3]
    default_font = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts' / 'simhei.ttf'
    generate(project_root / 'public' / 'materials' / 'equations.pdf', Path(sys.argv[1]) if len(sys.argv) > 1 else default_font)
