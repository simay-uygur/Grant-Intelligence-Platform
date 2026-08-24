# tests/make_test_form.py
# Creates a simple fillable PDF form to test pdf_fill against.

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

OUTPUT = "tests/sample_form.pdf"

c = canvas.Canvas(OUTPUT, pagesize=letter)
width, height = letter

# Title
c.setFont("Helvetica-Bold", 16)
c.drawString(72, height - 72, "Grant Application (Test Form)")

# We'll add three text fields with labels next to them.
form = c.acroForm
c.setFont("Helvetica", 12)

# Field 1: Organization name
c.drawString(72, height - 140, "Organization name:")
form.textfield(name="org_name", x=220, y=height - 145, width=250, height=20, borderWidth=1)

# Field 2: Project goal
c.drawString(72, height - 180, "Project goal:")
form.textfield(name="project_goal", x=220, y=height - 185, width=250, height=20, borderWidth=1)

# Field 3: Budget
c.drawString(72, height - 220, "Budget (EUR):")
form.textfield(name="budget", x=220, y=height - 225, width=250, height=20, borderWidth=1)

c.save()
print(f"Test form created: {OUTPUT}")
