import json
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT

with open("src/_data/site.json") as f:
    site = json.load(f)
with open("src/_data/resume.json") as f:
    resume = json.load(f)

INK = HexColor("#111111")
MUTED = HexColor("#444444")
ACCENT = HexColor("#0d7a5f")  # darker teal — readable on white/print

styles = getSampleStyleSheet()
name_style = ParagraphStyle("Name", fontName="Helvetica-Bold", fontSize=26, leading=30, textColor=INK, spaceAfter=4)
role_style = ParagraphStyle("Role", fontName="Helvetica", fontSize=12, leading=15, textColor=ACCENT, spaceAfter=5)
contact_style = ParagraphStyle("Contact", fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED, spaceAfter=10)
h2_style = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=ACCENT, spaceBefore=11, spaceAfter=5)
body_style = ParagraphStyle("Body", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13, spaceAfter=3)
entry_title_style = ParagraphStyle("EntryTitle", fontName="Helvetica-Bold", fontSize=10.5, textColor=INK, leading=13)
entry_period_style = ParagraphStyle("EntryPeriod", fontName="Helvetica-Oblique", fontSize=8.5, textColor=MUTED, leading=11, alignment=2)

doc = SimpleDocTemplate(
    "src/assets/resume.pdf",
    pagesize=letter,
    topMargin=0.55 * inch, bottomMargin=0.55 * inch,
    leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    title=f"{site['name']} - Resume", author=site['name'],
)

story = []
story.append(Paragraph(site["name"], name_style))
story.append(Paragraph(site["role"], role_style))
contact_line = f'{site["email"]} &nbsp;&middot;&nbsp; {site["linkedin"]} &nbsp;&middot;&nbsp; {site["github"]} &nbsp;&middot;&nbsp; {site["location"]}'
story.append(Paragraph(contact_line, contact_style))
story.append(HRFlowable(width="100%", thickness=0.75, color=HexColor("#dddddd"), spaceAfter=10))

story.append(Paragraph("SUMMARY", h2_style))
story.append(Paragraph(resume["summary"], body_style))

story.append(Paragraph("CORE SKILLS", h2_style))
for skill in resume["skills"]:
    story.append(Paragraph(f'<b>{skill["category"]}:</b> {", ".join(skill["items"])}', body_style))

story.append(Paragraph("EXPERIENCE", h2_style))
for item in resume["experience"]:
    row = Table(
        [[Paragraph(item["title"], entry_title_style), Paragraph(item["period"], entry_period_style)]],
        colWidths=[4.6 * inch, 1.65 * inch],
    )
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0,0), (-1,-1), 2), ("BOTTOMPADDING", (0,0), (-1,-1), 0)]))
    story.append(row)
    story.append(Paragraph(item["description"], body_style))
    story.append(Spacer(1, 3))

story.append(Paragraph("EDUCATION", h2_style))
edu = resume["education"]
row = Table(
    [[Paragraph(edu["degree"], entry_title_style), Paragraph(edu["period"], entry_period_style)]],
    colWidths=[4.6 * inch, 1.65 * inch],
)
row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
story.append(row)
story.append(Paragraph(edu["school"], body_style))

story.append(Paragraph("CERTIFICATIONS", h2_style))
for cert in resume["certifications"]:
    story.append(Paragraph(f'{cert["name"]} — {cert["period"]}', body_style))

doc.build(story)
print("PDF written")
