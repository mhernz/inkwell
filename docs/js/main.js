const { createApp, ref } = Vue;

const COURSES = JSON.parse(COURSE_DATA)["hits"]["hits"].map(
    (c) => c["_source"]
);

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

// https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash &= hash; // Convert to 32bit integer
    }
    return hash;
};

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
    return Math.min(Math.max(x, min), max)
}

function parseMeeting(meeting) {
    //           02/05:          Mon           4:00               - 5:00PM            ...
    let [_, days, timeStart, timeEnd, location] = meeting.match(MEETING_REGEX);
    days = days.split("/");
    // let meetingParts = meeting.split(" ")
    // let days = meetingParts[0].split("/")
    // let time = meetingParts[1].replace(",", "")
    // let [timeStart, timeEnd] = time.split("-")
    let timeString = timeStart + '-' + timeEnd;
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
            activeIdx: -1,
            scheduledMeetings: [],
        };
    },
    mounted() {
        if (localStorage.schedule) {
            this.scheduledMeetings = JSON.parse(localStorage.schedule);
        }
    },
    watch: {
        scheduledMeetings: {
            handler(newValue) {
                localStorage.schedule = JSON.stringify(newValue);
            },
            deep: true,
        },
    },
    computed: {
        courses() {
            return COURSES;
        },
        activeCourse() {
            return this.courses[this.activeIdx];
        },
        sessions() {
            let sessions = [];
            for (let [meetingIdx, m] of this.scheduledMeetings.entries()) {
                let courseIdx = m[0];
                console.log(m)
                let meetings = courseIdx == -1 ? [m[1]] : COURSES[courseIdx]["get_meetings"]
                for (let meeting of meetings) {
                    let parsedMeeting = parseMeeting(meeting);
                    for (let day of parsedMeeting["days"]) {
                        sessions.push([
                            courseIdx,
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
        scheduledCourses() {
            let courses = new Set();
            this.scheduledMeetings.filter(s => s[0] != -1).forEach(m => courses.add(m[0]));
            return [...courses]
        },
        credits() {
            let minCredits = this.scheduledMeetings.reduce((sum, meeting) => {
                return (
                    sum +
                    parseFloat(this.courses[meeting[0]]?.["min_unit"] ?? 0)
                );
            }, 0);
            let maxCredits = this.scheduledMeetings.reduce((sum, meeting) => {
                return (
                    sum +
                    parseFloat(this.courses[meeting[0]]?.["max_unit"] ?? 0)
                );
            }, 0);
            if (minCredits == maxCredits) return minCredits.toFixed(1);
            else return `${minCredits.toFixed(1)}-${maxCredits.toFixed(1)}`;
        },
    },
    methods: {
        selectCourse: function (idx) {
            this.activeIdx = idx;
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
        fitsSchedule(meetings) {
            let onSchedule = [];
            for (let [courseIdx, m] of this.scheduledMeetings) {
                if (courseIdx == -1) {
                    onSchedule.push(m)
                } else {
                    onSchedule.push(...this.courses[courseIdx]["get_meetings"])
                }
            }

            for (let scheduledMeeting of onSchedule) {
                for (let meeting of meetings) {
                    let parsedMeeting = parseMeeting(meeting);
                    let parsedScheduled = parseMeeting(scheduledMeeting);
                    if (
                        between(
                            parsedMeeting["time_end"],
                            parsedScheduled["time_start"],
                            parsedScheduled["time_end"]
                        ) ||
                        between(
                            parsedScheduled["time_end"],
                            parsedMeeting["time_start"],
                            parsedMeeting["time_end"]
                        )
                    ) {
                        let scheduledDays = new Set(parsedScheduled["days"]);

                        if (parsedMeeting["days"].some((d) => scheduledDays.has(d)))
                            return false;
                    }
                }
            }
            return true;
        },
        isScheduled(courseIdx, meeting) {
            return this.scheduledMeetings.some((m) => {
                return m[0] == courseIdx
            });
        },
        anyMeetingScheduled(courseIdx) {
            return this.scheduledMeetings.some((m) => m[0] == courseIdx);
        },
        schedule(courseIdx, meeting) {
            if (courseIdx != -1) this.unschedule(courseIdx);
            this.scheduledMeetings.push([courseIdx, meeting]);
        },
        unschedule(courseIdx) {
            this.scheduledMeetings = this.scheduledMeetings.filter(
                (m) => m[0] != courseIdx
            );
        },
        sessionCol(session) {
            return (
                ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(session[1]) +
                2
            );
        },
        sessionRow(session) {
            let start = Math.floor(session[2] * 4) - 32 + 3;
            start = clamp(start, 3, 66)
            let end = Math.floor(session[3] * 4) - 32 + 3;
            end = clamp(end, start, 66)
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
                let anyMeetingsFit =
                    this.anyMeetingScheduled(courseIdx) || this.fitsSchedule(course["get_meetings"]);
                if (!anyMeetingsFit) return false;
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
        courseColor(i) {
            if (i == -1) return "lightgray";
            let hue = simpleHash(this.courses[i]["section_code"]) % 360;
            return `oklch(90% 30% ${hue}deg)`
            // return `hsl(${hue}deg, 75%, 80%)`;
        },
        otherValid() {
            try {
                let meetingStr = `${this.otherDays.join("/")} ${
                    this.otherStart
                }-${this.otherEnd}, `;
                let parsed = parseMeeting(meetingStr);
                return (
                    parsed["time_start"] < parsed["time_end"] &&
                    this.fitsSchedule([meetingStr])
                );
            } catch (error) {
                console.log(error);
                return false;
            }
        },
        otherAdd() {
            this.schedule(
                -1,
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
