const { createApp, ref } = Vue;

const COURSE_CATALOG = JSON.parse(COURSE_DATA);
const TERMS = Object.keys(COURSE_CATALOG);

const SECTION_ID = "section_id";
const COURSE_MEETINGS = "get_meetings";
const ENROLLMENT_CODE = "def_refid";

const CUSTOM_MEETING_TIME = "custom_meeting_time";

function getCourseTermId(term, secId) {
    return COURSE_CATALOG[term]["courses"].filter((c) => c[SECTION_ID] == secId)[0];
}

const MEETING_REGEX =
    /(?:\d+\/\d+: )?([a-zA-Z\/]+) (\d+:\d+[A-Z]{0,2})-(\d+:\d+[A-Z]{0,2})(?:, )?(.*)/;

const HS2000_CODES = ["ETHSM", "LITPA", "PHCRT", "SSHIS", "SCIMA", "HAAVC"];
const HS3000_CODES = [
    "ETHSM",
    "LITPA",
    "PHCRT",
    "SSHIS",
    "SCIMA",
    "HAAVC",
    "WRLIT",
];
const HSALL_CODES = [...new Set([...HS2000_CODES, ...HS3000_CODES])];
const HNS_OFF = "off";
const HNS_ALL = "all";
const HNS_2000 = "2000";
const HNS_3000 = "3000";

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/
 */
function simpleHash(str, seed) {
    var i,
        l,
        hval = seed === undefined ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval +=
            (hval << 1) +
            (hval << 4) +
            (hval << 7) +
            (hval << 8) +
            (hval << 24);
    }
    return hval >>> 0;
}

function timeStringToHours(timeStr) {
    let parts = timeStr.split(":");
    let hrs = parseInt(parts[0]);
    let mins = parseInt(parts[1].substr(0, 2));
    let pm = parts[1].substr(2, 4) == "PM";
    return hrs + (pm && hrs != 12 ? 12 : 0) + mins / 60;
}

function between(x, min, max) {
    return x > min && x <= max;
}

function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
}

function parseMeetingTime(meetingTimeString) {
    //           02/05:          Mon           4:00               - 5:00PM            ...
    let [_, days, timeStart, timeEnd, location] = meetingTimeString.match(MEETING_REGEX);
    days = days.split("/");
    // let meetingParts = meeting.split(" ")
    // let days = meetingParts[0].split("/")
    // let time = meetingParts[1].replace(",", "")
    // let [timeStart, timeEnd] = time.split("-")
    let timeString = timeStart + "-" + timeEnd;
    if (timeStart.length < 6) timeStart += timeEnd.substr(-2);
    if (timeEnd.length < 6) timeEnd += timeStart.substr(-2);

    return {
        days: days,
        time_start: timeStringToHours(timeStart),
        time_end: timeStringToHours(timeEnd),
        location: location,
        time_string: timeString,
    };
}

function emptySchedule() {
    let schedule = {}
    for (const term of TERMS) {
        schedule[term] = []
    }
    return schedule
}

let app = createApp({
    setup() {
        return {
            count: ref(0),
        };
    },

    data() {
        return {
            searchTerm: "",
            hnsFilter: "off",
            studioFilter: "off",
            scheduleFilter: "off",
            showOtherActivity: false,
            otherDays: [],
            otherStart: "",
            otherEnd: "",
            activeTerm: TERMS[0],
            activeSecId: "",
            fullSchedule: emptySchedule(),
        };
    },

    mounted() {
        if (!localStorage.version) {
            localStorage.clear();
            localStorage.version = 1;
        }

        if (localStorage.activeTerm) {
            if (TERMS.includes(localStorage.activeTerm)) {
                this.activeTerm = localStorage.activeTerm;
            } else {
                localStorage.activeTerm = this.activeTerm;
            }
        }

        if (localStorage.fullSchedule) {
            let fullSchedule = JSON.parse(localStorage.fullSchedule);
            for (const term of TERMS) {
                if (!(term in fullSchedule)) fullSchedule[term] = [];
            }
            this.fullSchedule = fullSchedule;
        }
    },

    watch: {
        activeTerm: {
            handler(newValue) {
                localStorage.activeTerm = newValue;
            },
        },

        fullSchedule: {
            handler(newValue) {
                localStorage.fullSchedule = JSON.stringify(newValue);
            },
            deep: true,
        },
    },

    computed: {
        TERMS: function() {
            return TERMS;
        },

        courses() {
            return COURSE_CATALOG[this.activeTerm]["courses"];
        },

        enrollments() {
            return COURSE_CATALOG[this.activeTerm]["enrollments"];
        },

        activeSection() {
            return this.getCourse(this.activeSecId);
        },

        schedule() {
            return this.fullSchedule[this.activeTerm];
        },

        sessions() {
            let sessions = [];
            for (let [meetingIdx, m] of this.schedule.entries()) {
                let secId = m[SECTION_ID];
                let meetings =
                    secId == ""
                        ? [m[CUSTOM_MEETING_TIME]]
                        : this.getCourse(secId)[COURSE_MEETINGS];
                for (let meeting of meetings) {
                    let parsedMeeting = parseMeetingTime(meeting);
                    for (let day of parsedMeeting["days"]) {
                        sessions.push([
                            secId,
                            day,
                            parsedMeeting["time_start"],
                            parsedMeeting["time_end"],
                            // meeting.split(" ")[1].replace(",", ""),
                            parsedMeeting["time_string"],
                            parsedMeeting["location"],
                            meetingIdx,
                        ]);
                    }
                }
            }
            return sessions;
        },

        potentialSessions() {
            if (!this.activeSection) return;
            let sessions = [];
            let meetings = this.activeSection[COURSE_MEETINGS];
            for (let meeting of meetings) {
                let parsedMeeting = parseMeetingTime(meeting);
                for (let day of parsedMeeting["days"]) {
                    sessions.push([
                        this.activeSecId,
                        day,
                        parsedMeeting["time_start"],
                        parsedMeeting["time_end"],
                        // meeting.split(" ")[1].replace(",", ""),
                        parsedMeeting["time_string"],
                        parsedMeeting["location"],
                        -1,
                    ]);
                }
            }
            return sessions;
        },

        scheduledCourses() {
            return this.schedule
                .map((m) => m[SECTION_ID])
                .filter((i) => i != "");
        },

        credits() {
            let minCredits = this.schedule.reduce((sum, meeting) => {
                return (
                    sum +
                    parseFloat(
                        this.getCourse(meeting[SECTION_ID])?.["min_unit"] ?? 0
                    )
                );
            }, 0);
            let maxCredits = this.schedule.reduce((sum, meeting) => {
                return (
                    sum +
                    parseFloat(
                        this.getCourse(meeting[SECTION_ID])?.["max_unit"] ?? 0
                    )
                );
            }, 0);
            if (minCredits == maxCredits) return minCredits.toFixed(1);
            else return `${minCredits.toFixed(1)}-${maxCredits.toFixed(1)}`;
        },
    },

    methods: {
        selectCourse: function (course) {
            this.activeSecId = course[SECTION_ID];
        },

        getCourse: function (secId) {
            return getCourseTermId(this.activeTerm, secId);
        },

        fullTitle: function (course) {
            if (course === undefined) return "Custom activity";
            return course["section_code"] + ": " + course["title"];
        },

        instructors: function (course) {
            let instrs = course["_get_instructors"];
            return instrs.length == 0
                ? "No instructors listed"
                : instrs.join(", ");
        },

        enrollmentString: function (course) {
            let enrolled = this.enrollments[course[ENROLLMENT_CODE]];
            let cap = course["capacity"];
            return `Enrolled: ${enrolled}/${cap}`;
        },

        timeSince8Am: function (i) {
            let time = 8 + i - 1;
            if (time == 12) return "12pm";
            if (time > 12) return time - 12 + "pm";
            else return time + "am";
        },

        day(i) {
            return [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ][i - 1];
        },

        fitsSchedule(meetingTimes) {
            let scheduledMeetingTimes = [];
            for (let m of this.schedule) {
                if (m[SECTION_ID] == "") {
                    scheduledMeetingTimes.push(m[CUSTOM_MEETING_TIME]);
                } else {
                    scheduledMeetingTimes.push(
                        ...this.getCourse(m[SECTION_ID])[COURSE_MEETINGS]
                    );
                }
            }

            for (let t1 of scheduledMeetingTimes) {
                for (let t2 of meetingTimes) {
                    let p1 = parseMeetingTime(t1);
                    let p2 = parseMeetingTime(t2);
                    if (
                        between(
                            p2["time_end"],
                            p1["time_start"],
                            p1["time_end"]
                        ) ||
                        between(
                            p1["time_end"],
                            p2["time_start"],
                            p2["time_end"]
                        )
                    ) {
                        let days = new Set(p1["days"]);

                        if (p2["days"].some((d) => days.has(d)))
                            return false;
                    }
                }
            }
            return true;
        },

        isScheduled(secId) {
            return this.schedule.some((m) => m[SECTION_ID] == secId);
        },

        addToSchedule(secId, customMeetingTime) {
            if (secId != "") this.removeFromSchedule(secId);
            this.fullSchedule[this.activeTerm].push({
                [SECTION_ID]: secId,
                [CUSTOM_MEETING_TIME]: customMeetingTime,
            });
        },

        removeFromSchedule(secId) {
            this.fullSchedule[this.activeTerm] = this.schedule.filter((m) => m[SECTION_ID] != secId);
        },

        removeMeetingWithIdx(meetingIdx) {
            this.fullSchedule[this.activeTerm].splice(meetingIdx, 1);
        },

        clearSchedule() {
            this.fullSchedule[this.activeTerm] = [];
        },

        sessionCol(session) {
            return (
                ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(session[1]) +
                2
            );
        },

        sessionRow(session) {
            let start = Math.floor(session[2] * 4) - 32 + 3;
            start = clamp(start, 3, 66);
            let end = Math.floor(session[3] * 4) - 32 + 3;
            end = clamp(end, start, 66);
            return `${start} / ${end}`;
        },

        courseFilter: function (course, courseIdx) {
            switch (this.hnsFilter) {
                case HNS_OFF:
                    break;
                case HNS_ALL:
                    if (
                        !(
                            HS2000_CODES.some((code) =>
                                course["section_code"].includes(code + "-2")
                            ) ||
                            HS3000_CODES.some((code) =>
                                course["section_code"].includes(code + "-3")
                            )
                        )
                    ) {
                        return false;
                    }
                    break;
                case HNS_2000:
                    if (
                        !HS2000_CODES.some((code) =>
                            course["section_code"].includes(code + "-2")
                        )
                    ) {
                        return false;
                    }
                    break;
                case HNS_3000:
                    if (
                        !HS3000_CODES.some((code) =>
                            course["section_code"].includes(code + "-3")
                        )
                    ) {
                        return false;
                    }
                    break;
            }

            if (
                this.studioFilter == "on" &&
                course["instructional_format"] != "Studio"
            )
                return false;

            if (this.scheduleFilter == "on") {
                let show =
                    this.isScheduled(courseIdx) ||
                    this.fitsSchedule(course[COURSE_MEETINGS]);
                if (!show) return false;
            }

            if (this.searchTerm == "") return true;
            let courseData = this.fullTitle(course);
            if (course["_get_instructors"].length > 0)
                courseData += " " + this.instructors(course);
            courseData = courseData.toLowerCase();
            return this.searchTerm
                .toLowerCase()
                .split(" ")
                .every((t) => courseData.includes(t));
        },

        sectionColor(secId) {
            if (secId == "") return "lightgray";
            let hue = simpleHash(this.getCourse(secId)["section_code"]) % 360;
            return `oklch(90% 0.1 ${hue}deg)`;
            // return `hsl(${hue}deg, 75%, 80%)`;
        },

        otherValid() {
            try {
                let meetingStr = `${this.otherDays.join("/")} ${
                    this.otherStart
                }-${this.otherEnd}, `;
                let parsed = parseMeetingTime(meetingStr);
                return (
                    parsed["time_start"] < parsed["time_end"] &&
                    this.fitsSchedule([meetingStr])
                );
            } catch (error) {
                return false;
            }
        },

        otherAdd() {
            this.addToSchedule(
                "",
                `${this.otherDays.join("/")} ${this.otherStart}-${
                    this.otherEnd
                }, `
            );
            this.otherDays = [];
            this.otherStart = "";
            this.otherEnd = "";
        },

        courseCredits(course) {
            let minCredits = parseFloat(course["min_unit"] ?? 0);
            let maxCredits = parseFloat(course["max_unit"] ?? 0);
            if (minCredits == maxCredits) return minCredits.toFixed(1);
            else return `${minCredits.toFixed(1)}-${maxCredits.toFixed(1)}`;
        },

        strip(html) {
            let tmp = document.createElement("div");
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || "";
        },
    },
}).mount("#app");

const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
);
const tooltipList = [...tooltipTriggerList].map(
    (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
);
