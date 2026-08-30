# tests/test_qa.py
from tools.document_qa import document_qa

grant = {
    "title": "AI-Driven Robotics for Smart Manufacturing",
    "programme": "Horizon Europe",
    "deadline": "2027-09-15",
    "description": "Supports AI and robotics innovation in industrial manufacturing settings.",
}
profile = {"organisationName": "VisionWorks Robotics", "organisationType": "SME", "country": "Germany"}
document = {
    "sections": [
        {"id": "org-overview", "title": "Organisation Overview",
         "content": "VisionWorks Robotics is a German SME building AI quality inspection systems."},
        {"id": "innovation", "title": "Innovation",
         "content": "We use CNN-based computer vision to detect manufacturing defects."},
    ],
}

print("===== Q: about the grant =====")
r = document_qa("What is the deadline, and are we eligible as a German SME?", document, grant, profile)
print(r["answer"][:600])