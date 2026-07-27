import json

import httpx

from app.clients.sources.eu_horizon import EUHorizonClient
from app.schemas.grants import GrantSearchRequest


def test_search_returns_normalized_horizon_topics_only() -> None:
    payload = {
        "results": [
            {
                "url": (
                    "https://ec.europa.eu/info/funding-tenders/opportunities/portal/"
                    "screen/opportunities/topic-details/HORIZON-EIC-2026-BAS-01-ECOSYSTEM"
                ),
                "summary": "EIC ecosystem support",
                "metadata": {
                    "identifier": ["HORIZON-EIC-2026-BAS-01-ECOSYSTEM"],
                    "title": ["EIC Ecosystem Support"],
                    "frameworkProgramme": ["43108390"],
                    "programmePeriod": ["2021 - 2027"],
                    "typesOfAction": ["HORIZON Coordination and Support Actions"],
                    "deadlineDate": ["2026-12-01T00:00:00.000+0000"],
                    "descriptionByte": ["<p>Support for ecosystem services.</p>"],
                    "budgetOverview": [
                        json.dumps(
                            {
                                "budgetTopicActionMap": {
                                    "1": [
                                        {
                                            "maxContribution": 4500000,
                                        }
                                    ]
                                }
                            }
                        )
                    ],
                    "actions": [
                        json.dumps(
                            [
                                {
                                    "status": {"abbreviation": "Open"},
                                    "deadlineDates": ["2026-12-01"],
                                }
                            ]
                        )
                    ],
                },
            },
            {
                "url": (
                    "https://ec.europa.eu/info/funding-tenders/opportunities/portal/"
                    "screen/support/faq/12345"
                ),
                "summary": "Should be ignored",
                "metadata": {},
            },
        ]
    }

    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    client = EUHorizonClient(transport=transport)

    results = client.search(GrantSearchRequest(query="HORIZON-2026"))

    assert len(results) == 1
    assert results[0].id == "HORIZON-EIC-2026-BAS-01-ECOSYSTEM"
    assert results[0].amount == "EUR 4 500 000"
    assert results[0].deadline == "2026-12-01"


def test_search_applies_open_and_budget_filters() -> None:
    payload = {
        "results": [
            {
                "url": (
                    "https://ec.europa.eu/info/funding-tenders/opportunities/portal/"
                    "screen/opportunities/topic-details/HORIZON-CL4-2026-OPEN-01"
                ),
                "summary": "Open topic",
                "metadata": {
                    "identifier": ["HORIZON-CL4-2026-OPEN-01"],
                    "title": ["Open Topic"],
                    "frameworkProgramme": ["43108390"],
                    "typesOfAction": ["HORIZON Research and Innovation Actions"],
                    "deadlineDate": ["2026-11-15T00:00:00.000+0000"],
                    "budgetOverview": [
                        json.dumps(
                            {
                                "budgetTopicActionMap": {
                                    "1": [{"maxContribution": 6000000}]
                                }
                            }
                        )
                    ],
                    "actions": [
                        json.dumps(
                            [
                                {
                                    "status": {"abbreviation": "Open"},
                                    "deadlineDates": ["2026-11-15"],
                                }
                            ]
                        )
                    ],
                },
            },
            {
                "url": (
                    "https://ec.europa.eu/info/funding-tenders/opportunities/portal/"
                    "screen/opportunities/topic-details/HORIZON-CL4-2026-CLOSED-01"
                ),
                "summary": "Closed topic",
                "metadata": {
                    "identifier": ["HORIZON-CL4-2026-CLOSED-01"],
                    "title": ["Closed Topic"],
                    "frameworkProgramme": ["43108390"],
                    "typesOfAction": ["HORIZON Research and Innovation Actions"],
                    "deadlineDate": ["2026-01-15T00:00:00.000+0000"],
                    "budgetOverview": [
                        json.dumps(
                            {
                                "budgetTopicActionMap": {
                                    "1": [{"maxContribution": 2000000}]
                                }
                            }
                        )
                    ],
                    "actions": [
                        json.dumps(
                            [
                                {
                                    "status": {"abbreviation": "Closed"},
                                    "deadlineDates": ["2026-01-15"],
                                }
                            ]
                        )
                    ],
                },
            },
        ]
    }

    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    client = EUHorizonClient(transport=transport)

    results = client.search(
        GrantSearchRequest(
            query="HORIZON-2026",
            only_open=True,
            budget_min=5000000,
        )
    )

    assert [result.id for result in results] == ["HORIZON-CL4-2026-OPEN-01"]


def test_search_does_not_send_country_or_organization_type_upstream() -> None:
    seen_requests: list[httpx.Request] = []
    payload = {
        "results": [
            {
                "url": (
                    "https://ec.europa.eu/info/funding-tenders/opportunities/portal/"
                    "screen/opportunities/topic-details/HORIZON-CL4-2026-OPEN-01"
                ),
                "summary": "Open topic",
                "metadata": {
                    "identifier": ["HORIZON-CL4-2026-OPEN-01"],
                    "title": ["Open Topic"],
                    "frameworkProgramme": ["43108390"],
                },
            }
        ]
    }

    def handler(request: httpx.Request) -> httpx.Response:
        seen_requests.append(request)
        return httpx.Response(200, json=payload)

    client = EUHorizonClient(transport=httpx.MockTransport(handler))

    results = client.search(
        GrantSearchRequest(
            query="robotics",
            country="Turkey",
            organization_type="SME",
        )
    )

    assert [result.id for result in results] == ["HORIZON-CL4-2026-OPEN-01"]
    assert len(seen_requests) == 1
    assert seen_requests[0].url.params["apiKey"] == "SEDIA"
    assert seen_requests[0].url.params["text"] == "robotics"
    assert seen_requests[0].url.params["language"] == "en"
    assert "country" not in seen_requests[0].url.params
    assert "organization_type" not in seen_requests[0].url.params
