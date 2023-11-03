import requests
import json

LARGE_NUMBER = 10000

headers = {
    'Content-Type': 'application/json;charset=utf-8',
    'Accept': 'application/json, text/plain, */*',
    'Sec-Fetch-Site': 'same-origin',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Mode': 'cors',
    'Host': 'portal.cca.edu',
    'Origin': 'https://portal.cca.edu',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Referer': 'https://portal.cca.edu/courses/?term%5B0%5D=Spring+2024',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
}

json_data = {
    'post_filter': {
        'term': {
            'get_term_filter': 'Spring 2024',
        },
    },
    'aggs': {
        'term3': {
            'filter': {
                'match_all': {},
            },
            'aggs': {
                'get_term_filter': {
                    'terms': {
                        'field': 'get_term_filter',
                        'size': 50,
                    },
                },
                'get_term_filter_count': {
                    'cardinality': {
                        'field': 'get_term_filter',
                    },
                },
            },
        },
        'Start_time4': {
            'filter': {
                'term': {
                    'get_term_filter': 'Spring 2024',
                },
            },
            'aggs': {
                'get_start_windows_filter': {
                    'terms': {
                        'field': 'get_start_windows_filter',
                        'size': 50,
                    },
                },
                'get_start_windows_filter_count': {
                    'cardinality': {
                        'field': 'get_start_windows_filter',
                    },
                },
            },
        },
        'location5': {
            'filter': {
                'term': {
                    'get_term_filter': 'Spring 2024',
                },
            },
            'aggs': {
                'get_location_filter': {
                    'terms': {
                        'field': 'get_location_filter',
                        'size': 50,
                        'exclude': [
                            '',
                        ],
                    },
                },
                'get_location_filter_count': {
                    'cardinality': {
                        'field': 'get_location_filter',
                    },
                },
            },
        },
        'subject_menu6': {
            'filter': {
                'term': {
                    'get_term_filter': 'Spring 2024',
                },
            },
            'aggs': {
                'get_subject_filter': {
                    'terms': {
                        'field': 'get_subject_filter',
                        'size': 50,
                        'order': {
                            '_term': 'asc',
                        },
                    },
                },
                'get_subject_filter_count': {
                    'cardinality': {
                        'field': 'get_subject_filter',
                    },
                },
            },
        },
        'subject13': {
            'filter': {
                'term': {
                    'get_term_filter': 'Spring 2024',
                },
            },
            'aggs': {
                'get_subject_filter': {
                    'terms': {
                        'field': 'get_subject_filter',
                        'size': 50,
                        'order': {
                            '_term': 'asc',
                        },
                    },
                },
                'get_subject_filter_count': {
                    'cardinality': {
                        'field': 'get_subject_filter',
                    },
                },
            },
        },
    },
    'size': LARGE_NUMBER,
    'highlight': {
        'fields': {
            'title': {},
            'get_section_description': {},
            '_get_instructors': {},
        },
    },
    'sort': [
        {
            'get_subject_filter': 'asc',
        },
        {
            'get_course_number_filter': 'asc',
        },
        {
            'section_number_filter': 'asc',
        },
    ],
}

response = requests.post('https://portal.cca.edu/search/courses/_search', headers=headers, json=json_data)
out_file = __file__.replace("py", "json")
with open(out_file, 'w') as file:
    file.write(json.dumps(response.json()))
