# tests/test_fill.py
# Fills the sample form with values and saves a completed PDF.

from tools.pdf_fill import pdf_fill

# The values to write into each field (keys must match the field names).
values = {
    "org_name": "Green Energy Solutions Ltd",
    "project_goal": "Develop solar panel recycling technology",
    "budget": "250000",
}

pdf_fill(
    input_pdf="tests/sample_form.pdf",
    output_pdf="tests/filled_form.pdf",
    field_values=values,
)
