import csv
from datetime import datetime
from decimal import Decimal
from io import BytesIO, StringIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.trading import TradingTrade
from app.schemas.trading import MonthOut
from app.services import trading_service as ts

GOLD = colors.HexColor("#d4a72c")
BLACK = colors.HexColor("#050505")
WHITE = colors.white
GRAY = colors.HexColor("#a1a1aa")


def _fmt_money(value: float | None) -> str:
    if value is None:
        return "—"
    return f"US$ {value:,.2f}"


def _table(rows: list[list], header: bool = True) -> Table:
    table = Table(rows, colWidths=None, repeatRows=1 if header else 0)
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
