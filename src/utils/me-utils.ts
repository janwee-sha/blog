import {meConfig} from "../me.config";

type DateParts = {
    year: number;
    month: number;
    day: number;
};

function parseDateOnly(value: string): DateParts {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        throw new Error(`Invalid date: ${value}. Expected YYYY-MM-DD.`);
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error(`Invalid calendar date: ${value}.`);
    }

    return {year, month, day};
}

function getDateParts(date: Date, timeZone: string): DateParts {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
    };
}

export function calculateFullYears(
    startedAt: string,
    asOf: Date,
    timeZone: string,
): number {
    const start = parseDateOnly(startedAt);
    const current = getDateParts(asOf, timeZone);
    let years = current.year - start.year;

    if (
        current.month < start.month ||
        (current.month === start.month && current.day < start.day)
    ) {
        years -= 1;
    }

    if (years < 0) {
        throw new Error("Career start date cannot be in the future.");
    }

    return years;
}

export function getExperienceYears(asOf = new Date()): number {
    return calculateFullYears(meConfig.careerStartedAt, asOf, meConfig.timeZone);
}

export function findSocialLink(id: string) {
    return meConfig.socialLinks.find((link) => link.id === id);
}
