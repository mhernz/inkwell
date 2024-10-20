import requests
from pathlib import Path
import json
import logging
import contextlib
from http.client import HTTPConnection

HTTPConnection.debuglevel = 1

logging.basicConfig()
logging.getLogger().setLevel(logging.DEBUG)
requests_log = logging.getLogger("requests.packages.urllib3")
requests_log.setLevel(logging.DEBUG)
requests_log.propagate = True

LARGE_NUMBER = 10000
TERMS = ["Spring 2025", "Fall 2024"]


def headers(term):
    season, year = term.split(" ")
    return {
        "Content-Type": "application/json;charset=utf-8",
        "Accept": "application/json, text/plain, */*",
        "Sec-Fetch-Site": "same-origin",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Mode": "cors",
        "Host": "portal.cca.edu",
        "Origin": "https://portal.cca.edu",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
        "Referer": f"https://portal.cca.edu/courses/?term%5B0%5D={season}+{year}",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
    }


def search_post_data(term):
    return {
        "post_filter": {"term": {"get_term_filter": term}},
        "aggs": {
            "term3": {
                "filter": {"match_all": {}},
                "aggs": {
                    "get_term_filter": {
                        "terms": {"field": "get_term_filter", "size": LARGE_NUMBER}
                    },
                    "get_term_filter_count": {
                        "cardinality": {"field": "get_term_filter"}
                    },
                },
            },
            "Start_time4": {
                "filter": {"term": {"get_term_filter": term}},
                "aggs": {
                    "get_start_windows_filter": {
                        "terms": {
                            "field": "get_start_windows_filter",
                            "size": LARGE_NUMBER,
                        }
                    },
                    "get_start_windows_filter_count": {
                        "cardinality": {"field": "get_start_windows_filter"}
                    },
                },
            },
            "location5": {
                "filter": {"term": {"get_term_filter": term}},
                "aggs": {
                    "get_location_filter": {
                        "terms": {
                            "field": "get_location_filter",
                            "size": LARGE_NUMBER,
                            "exclude": [""],
                        }
                    },
                    "get_location_filter_count": {
                        "cardinality": {"field": "get_location_filter"}
                    },
                },
            },
            "subject_menu6": {
                "filter": {"term": {"get_term_filter": "Fall 2024"}},
                "aggs": {
                    "get_subject_filter": {
                        "terms": {
                            "field": "get_subject_filter",
                            "size": LARGE_NUMBER,
                            "order": {"_term": "asc"},
                        }
                    },
                    "get_subject_filter_count": {
                        "cardinality": {"field": "get_subject_filter"}
                    },
                },
            },
            "subject13": {
                "filter": {"term": {"get_term_filter": "Fall 2024"}},
                "aggs": {
                    "get_subject_filter": {
                        "terms": {
                            "field": "get_subject_filter",
                            "size": LARGE_NUMBER,
                            "order": {"_term": "asc"},
                        }
                    },
                    "get_subject_filter_count": {
                        "cardinality": {"field": "get_subject_filter"}
                    },
                },
            },
        },
        "size": LARGE_NUMBER,
        "highlight": {
            "fields": {
                "title": {},
                "get_section_description": {},
                "_get_instructors": {},
            }
        },
        "sort": [
            {"get_subject_filter": "asc"},
            {"get_course_number_filter": "asc"},
            {"section_number_filter": "asc"},
        ],
    }

def chunks(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

output = {}

for term in TERMS:
    output[term] = {}

    response = requests.post(
        "https://portal.cca.edu/search/courses/_search", headers=headers(term), json=search_post_data(term)
    )
    response = response.json()
    courses = [c["_source"] for c in response["hits"]["hits"]]
    output[term]["courses"] = courses

    def_ids = [c["def_refid"] for c in courses]

    output[term]["enrollments"] = {}
    for chunk in chunks(def_ids, 25):
        response = requests.post("https://portal.cca.edu/wddata/section_enrollments?def_refids=" + ",".join(chunk))
        response = response.json()
        output[term]["enrollments"].update(response)


out_file = (Path(__file__).parent / "../docs/js/data.js").resolve()
with open(out_file, "w") as file:
    file.write("COURSE_DATA = String.raw`" + json.dumps(output) + "`")
