# tests/test_edit.py
# Tests edit_doc_replace by changing the budget in the sample application.

from tools.edit_doc_replace import edit_doc_replace

# Replace the old budget with a new one, saving to a new file so we keep the original.
edit_doc_replace(
    doc_path="tests/sample_application.docx",
    old_text="250000 EUR",
    new_text="300000 EUR",
    output_path="tests/edited_application.docx",
)