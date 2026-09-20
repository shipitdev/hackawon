from app.models import HackathonRecord, ProblemSource
from app.problems import enrich_problem_sources, google_doc_export_url


def record(source: ProblemSource) -> HackathonRecord:
    return HackathonRecord(
        source="unstop",
        source_id="1",
        title="Hack",
        url="https://unstop.com/hackathons/hack-1",
        problem_sources=[source],
    )


def test_google_doc_links_use_the_public_text_export():
    assert (
        google_doc_export_url("https://docs.google.com/document/d/abc123/edit?usp=sharing")
        == "https://docs.google.com/document/d/abc123/export?format=txt"
    )


def test_public_google_doc_text_is_added_to_the_problem_source():
    class Response:
        text = "Problem 1: Reduce food waste in college kitchens."
        headers = {"content-type": "text/plain"}

    class Client:
        def get(self, url):
            assert url.endswith("/export?format=txt")
            return Response()

    item = record(
        ProblemSource(
            kind="google_doc",
            title="Problem booklet",
            url="https://docs.google.com/document/d/abc123/edit",
            status="linked",
        )
    )
    enrich_problem_sources([item], Client())
    assert item.problem_sources[0].status == "parsed"
    assert "Reduce food waste" in item.problem_sources[0].text


def test_failed_or_private_documents_remain_linked():
    class Client:
        def get(self, url):
            raise RuntimeError("private")

    item = record(
        ProblemSource(
            kind="google_doc",
            url="https://docs.google.com/document/d/private/edit",
            status="linked",
        )
    )
    enrich_problem_sources([item], Client())
    assert item.problem_sources[0].status == "linked"
    assert item.problem_sources[0].text is None


def test_private_network_links_are_not_fetched():
    class Client:
        def get(self, url):
            raise AssertionError("must not fetch private addresses")

    item = record(ProblemSource(kind="external", url="http://127.0.0.1/problems", status="linked"))
    enrich_problem_sources([item], Client())
    assert item.problem_sources[0].status == "unavailable"
    assert item.problem_sources[0].url is None
