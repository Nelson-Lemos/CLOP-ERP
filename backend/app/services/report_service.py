from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.user import User
from app.services import productivity_service as ps

GOLD = colors.HexColor("#d4a72c")
BLACK = colors.HexColor("#050505")
DARK = colors.HexColor("#0d0d0d")
WHITE = colors.white
GRAY = colors.HexColor("#a1a1aa")


def build_report_data(db, *, user: User | None = None, department_id: int | None = None, label: str, start: datetime | None = None, end: datetime | None = None) -> dict:
    metrics = ps.compute_metrics(db, user_id=user.id if user else None, department_id=department_id, start=start, end=end)
    breakdown = ps.department_breakdown(db) if not user else None
    monthly = ps.monthly_progression(db, user_id=user.id if user else None, department_id=department_id) if start is None else None
    return {
        "label": label,
        "periodo": f"{start.strftime('%d/%m/%Y') if start else 'início'} — {end.strftime('%d/%m/%Y') if end else 'hoje'}",
        "start": start,
        "end": end,
        "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "metrics": metrics,
        "status_distribution": ps.status_distribution(db, user_id=user.id if user else None, department_id=department_id),
        "department_breakdown": breakdown,
        "monthly": monthly,
        "department_nome": user.departamento.nome if user and user.departamento else None,
        "user_nome": user.nome_completo if user else None,
    }


def _table(rows: list[list], header: bool = True) -> Table:
    cols = len(rows[0]) if rows else 0
    table = Table(rows, colWidths=None, repeatRows=1 if header else 0)
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, 0), BLACK),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#f4f4f5")]),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    table.setStyle(TableStyle(style))
    return table


def _bullet_x_axis(c: canvas.Canvas, points: list[float], labels: list[str], y: float):
    width = 160 * mm
    for x, lbl in zip(points, labels):
        c.drawCentredString(x, y - 3 * mm, lbl)


def render_pdf(data: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleClop", parent=styles["Title"], textColor=BLACK, fontSize=18, spaceAfter=2)
    subtitle_style = ParagraphStyle("SubClop", parent=styles["Normal"], textColor=GRAY, fontSize=9, spaceAfter=10)
    h2 = ParagraphStyle("H2Clop", parent=styles["Heading2"], textColor=BLACK, fontSize=12, spaceBefore=12, spaceAfter=4)

    m = data["metrics"]
    story_elements = [
        Paragraph("CLOP MANAGEMENT", title_style),
        Paragraph(
            f"{data['label']} — período {data['periodo']} · gerado a {data['generated_at']}",
            subtitle_style,
        ),
        Paragraph("RESUMO", h2),
        _table([
            ["Total de tarefas", "Concluídas", "Pendentes", "Atrasadas", "Rejeitadas", "Taxa de conclusão", "No prazo", "Méd. conclusão (h)", "Pontuação"],
            [
                str(m["total_tasks"]), str(m["completed_tasks"]), str(m["pending_tasks"]),
                str(m["overdue_tasks"]), str(m["rejected_tasks"]),
                f"{m['completion_rate']}%", f"{m['on_time_rate']}%",
                str(m["average_completion_time"]), f"{m['weighted_score']}%",
            ],
        ], header=False),
    ]

    dist = data["status_distribution"]
    if dist:
        story_elements.append(Paragraph("ESTADO DAS TAREFAS", h2))
        story_elements.append(_table([["Estado", "Quantidade"]] + [[k, str(v)] for k, v in dist.items()], header=True))

    if data.get("department_breakdown"):
        story_elements.append(Paragraph("PRODUTIVIDADE POR DEPARTAMENTO", h2))
        rows = [["Departamento", "Total", "Concluídas", "Pendentes", "Atrasadas", "Taxa"]]
        for d in data["department_breakdown"]:
            rows.append([d["nome"], str(d["total_tasks"]), str(d["completed_tasks"]), str(d["pending_tasks"]), str(d["overdue_tasks"]), f"{d['completion_rate']}%"])
        story_elements.append(_table(rows))

    footer = "CLOP Academia Digital, LDA — CONFIANÇA. DISCIPLINA. LUCRO."
    story_elements.append(Spacer(1, 10))
    story_elements.append(Paragraph(footer, subtitle_style))

    doc.build(story_elements)
    return buf.getvalue()