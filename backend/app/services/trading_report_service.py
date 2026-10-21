import csv
from datetime import datetime
from decimal import Decimal
from io import BytesIO, StringIO
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.trading import TradingTrade
from app.schemas.trading import MonthOut
from app.services import trading_service as ts

GOLD = colors.HexColor("#d4a72c")
BLACK = colors.HexColor("#050505")
WHITE = colors.white
GRAY = colors.HexColor("#a1a1aa")
LIGHT = colors.HexColor("#f4f4f5")

THUMB_WIDTH = 40 * mm
THUMB_HEIGHT = 28 * mm


def _fmt_money(value: float | None) -> str:
    if value is None:
        return "—"
    return f"US$ {value:,.2f}"


def _table(rows: list[list], header: bool = True, col_widths: list | None = None) -> Table:
    table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, 0), BLACK),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#f4f4f5")]),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return table


def _thumbnail_flowable(file_path: str | None) -> Image | None:
    if not file_path:
        return None
    path = Path(file_path)
    if not path.exists():
        return None
    try:
        with PILImage.open(path) as img:
            thumb = img.convert("RGB")
            thumb.thumbnail((int(THUMB_WIDTH), int(THUMB_HEIGHT)))
            width, height = thumb.size
            buffer = BytesIO()
            thumb.save(buffer, format="PNG")
    except Exception:
        return None
    buffer.seek(0)
    scale = min(THUMB_WIDTH / width, THUMB_HEIGHT / height, 1)
    return Image(buffer, width=width * scale, height=height * scale)


def trades_csv(trades: list[TradingTrade], *, operator_nome: str) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([
        "Data", "Ativo", "Direção", "Estado", "Valor (US$)", "Risco:Retorno",
        "Seguiu o plano", "Mindset", "Observações", "Operador",
    ])
    for trade in trades:
        valor = float(Decimal(trade.valor_finaneiro)) if trade.valor_finaneiro is not None else ""
        writer.writerow([
            trade.data_operacao.strftime("%d/%m/%Y"),
            trade.ativo,
            trade.direcao,
            trade.estado,
            valor,
            f"1:{trade.risco_retorno}" if trade.risco_retorno is not None else "",
            "Sim" if trade.seguiu_plano else "Não",
            trade.mindset or "",
            trade.observacoes or "",
            operator_nome,
        ])
    return buffer.getvalue()


def evolution_csv(*, ano: int, meses: list[MonthOut], total: MonthOut) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([
        "Mês", "Gain (US$)", "Loss (US$)", "Resultado (US$)", "Saldo inicial (US$)",
        "Depósitos (US$)", "Bónus (US$)", "Saques (US$)", "Saldo final (US$)", "% de acerto",
    ])
    for month in meses:
        writer.writerow([
            ts.month_label(ano, month.mes), f"{month.gain:.2f}", f"{month.loss:.2f}",
            f"{month.resultado:.2f}", f"{month.saldo_inicial:.2f}", f"{month.depositos:.2f}",
            f"{month.bonus:.2f}", f"{month.saques:.2f}", f"{month.saldo_final:.2f}",
            f"{month.taxa_acerto}%",
        ])
    writer.writerow([
        "TOTAL", "", "", f"{total.resultado:.2f}", f"{total.saldo_inicial:.2f}",
        f"{total.depositos:.2f}", f"{total.bonus:.2f}", f"{total.saques:.2f}",
        f"{total.saldo_final:.2f}", f"{total.taxa_acerto}%",
    ])
    return buffer.getvalue()


def render_monthly_report_pdf(report: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleClop", parent=styles["Title"], textColor=BLACK, fontSize=18, spaceAfter=2)
    subtitle_style = ParagraphStyle("SubClop", parent=styles["Normal"], textColor=GRAY, fontSize=9, spaceAfter=10)
    h2 = ParagraphStyle("H2Clop", parent=styles["Heading2"], textColor=BLACK, fontSize=12, spaceBefore=12, spaceAfter=4)

    r = report["resumo"]
    story: list = [
        Paragraph("CLOP MANAGEMENT", title_style),
        Paragraph(
            f"Relatório Mensal de Trading — {report['operator_nome']} · {ts.month_label(report['ano'], report['mes'])} · gerado a {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            subtitle_style,
        ),
        Paragraph("RESUMO DO MÊS", h2),
        _table([
            ["Operações", "Ganhou", "Perdeu", "Pendente", "Em andamento", "Taxa de acerto", "Resultado", "Saldo final", "R:R médio"],
            [
                str(r["total_operacoes"]), str(r["ganhou"]), str(r["perdeu"]), str(r["pendente"]),
                str(r["em_andamento"]), f"{r['taxa_acerto']}%", _fmt_money(r["resultado"]),
                _fmt_money(r["saldo_final"]), f"1:{r['risco_retorno_medio']}",
            ],
        ], header=False),
    ]

    plano = report["plano"]
    story.append(Paragraph("PLANO OPERACIONAL", h2))
    story.append(_table([
        ["Seguiu o plano", "Resultado", "Não seguiu o plano", "Resultado", "Taxa de seguimento"],
        [
            str(plano["seguhou_total"]), _fmt_money(plano["seguhou_resultado"]),
            str(plano["nao_seguhou_total"]), _fmt_money(plano["nao_seguhou_resultado"]),
            f"{plano['taxa_seguimento']}%",
        ],
    ], header=False))

    if report["mindset"]:
        story.append(Paragraph("RESULTADO POR ESTADO EMOCIONAL", h2))
        story.append(_table(
            [["Mindset", "Operações", "Ganhou", "Perdeu", "Resultado"]]
            + [[m["chave"], str(m["total"]), str(m["ganhou"]), str(m["perdeu"]), _fmt_money(m["resultado"])] for m in report["mindset"]]
        ))

    if report["ativos"]:
        story.append(Paragraph("RESULTADO POR ATIVO", h2))
        story.append(_table(
            [["Ativo", "Operações", "Taxa de acerto", "Resultado"]]
            + [[a["chave"], str(a["total"]), f"{a['taxa_acerto']}%", _fmt_money(a["resultado"])] for a in report["ativos"]]
        ))

    if report["direcoes"]:
        story.append(Paragraph("RESULTADO POR DIREÇÃO", h2))
        story.append(_table(
            [["Direção", "Operações", "Taxa de acerto", "Resultado"]]
            + [[d["chave"], str(d["total"]), f"{d['taxa_acerto']}%", _fmt_money(d["resultado"])] for d in report["direcoes"]]
        ))

    if report["dias_semana"]:
        story.append(Paragraph("RESULTADO POR DIA DA SEMANA", h2))
        story.append(_table(
            [["Dia", "Operações", "Perdeu", "Resultado"]]
            + [[d["chave"], str(d["total"]), str(d["perdeu"]), _fmt_money(d["resultado"])] for d in report["dias_semana"]]
        ))

    execucao = report["execucao"]
    story.append(Paragraph("EXECUÇÃO", h2))
    story.append(_table([
        ["Nota média (1–5)", "Dias com checklist"],
        [str(execucao["nota_media"]), str(execucao["dias_com_checklist"])],
    ], header=False))
    itens = execucao["itens_nao_cumpridos"]
    story.append(_table(
        [["Item não cumprido", "Dias"]] + [[label.replace("sem_", "Sem ").replace("_", " "), str(count)] for label, count in itens.items()]
    ))

    evidencia = report.get("evidencia") or {}
    story.append(Paragraph("EVIDÊNCIAS E REVISÃO DO LÍDER", h2))
    story.append(_table([
        ["Fechadas", "Com evidência", "% com evidência", "Aprovadas", "% aprovadas", "Inconsistências", "Correcções pedidas", "Divergências de plano"],
        [
            str(evidencia.get("total_fechadas", 0)),
            str(evidencia.get("com_evidencia", 0)),
            f"{evidencia.get('pct_com_evidencia', 0)}%",
            str(evidencia.get("aprovadas", 0)),
            f"{evidencia.get('pct_aprovadas', 0)}%",
            str(evidencia.get("inconsistentes", 0)),
            str(evidencia.get("correcoes_pedidas", 0)),
            str(evidencia.get("divergencias_plano", 0)),
        ],
    ], header=False))

    capturas = report.get("capturas") or []
    if capturas:
        story.append(Paragraph("CAPTURAS — OPERAÇÕES PERDIDAS OU FORA DO PLANO", h2))
        cell_style = ParagraphStyle("CellCaptura", parent=styles["Normal"], fontSize=8, leading=10)
        rows = []
        for item in capturas:
            label = Paragraph(
                f"<b>{item['ativo']}</b> · {item['data_operacao']} · {item['estado']}<br/>"
                f"Valor: {_fmt_money(item.get('valor_finaneiro'))}<br/>"
                f"{'Seguiu' if item['seguiu_plano'] else '<b>Não seguiu</b>'} o plano<br/>"
                f"Revisão: {item.get('revisao_estado', 'NAO_REVISADA').replace('_', ' ').title()}",
                cell_style,
            )
            flows = [f for f in (_thumbnail_flowable(i.get("file_path")) for i in item["imagens"]) if f is not None]
            if not flows:
                flows = [Paragraph("Sem captura anexada", cell_style)]
            row = [label] + flows[:3] + [""] * max(0, 3 - len(flows[:3]))
            rows.append(row)
        story.append(_table(rows, header=False, col_widths=[46 * mm, 42 * mm, 42 * mm, 42 * mm]))

    if report["observacoes"]:
        story.append(Paragraph("OBSERVAÇÕES DO MÊS", h2))
        story.append(_table(
            [["Data", "Ativo", "Estado", "Mindset", "Observação"]]
            + [[o["data_operacao"], o["ativo"], o["estado"], o["mindset"] or "—", o["observacoes"]] for o in report["observacoes"]]
        ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("CLOP Academia Digital, LDA — CONFIANÇA. DISCIPLINA. LUCRO.", subtitle_style))
    doc.build(story)
    return buf.getvalue()
