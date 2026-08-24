# tools/pdf_fill.py
# Fills a fillable PDF form: reads its form fields and writes values into them.
# Works on PDFs that have real interactive form fields (the common case for official forms).

from pypdf import PdfReader, PdfWriter


def list_fields(pdf_path):
    """
    Inspect a PDF and return the names of its fillable form fields.
    Use this first to discover what fields a form has before filling.
    """
    reader = PdfReader(pdf_path)
    fields = reader.get_fields()
    if not fields:
        print("[pdf_fill] This PDF has no fillable form fields.")
        return []
    return list(fields.keys())


def pdf_fill(input_pdf, output_pdf, field_values):
    """
    Fill a fillable PDF form.

    input_pdf: path to the blank form
    output_pdf: where to save the filled form
    field_values: dict of {field_name: value_to_write}
    """
    reader = PdfReader(input_pdf)
    writer = PdfWriter()

    # Copy all pages from the original into our writer.
    writer.append(reader)

    # Write our values into the form fields on each page.
    for page in writer.pages:
        writer.update_page_form_field_values(page, field_values)

    # Save the filled PDF.
    with open(output_pdf, "wb") as f:
        writer.write(f)

    print(f"[pdf_fill] Filled form saved to {output_pdf}")


if __name__ == "__main__":
    # Quick self-test: list fields of a sample form if one exists.
    import sys

    if len(sys.argv) > 1:
        path = sys.argv[1]
        print("Fields found:", list_fields(path))
    else:
        print("Pass a PDF path to list its fields, e.g.:")
        print("  python -m tools.pdf_fill somefile.pdf")
