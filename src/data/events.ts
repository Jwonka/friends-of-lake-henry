// src/data/events.ts
export type EventKind = "Event" | "Raffle" | "Fundraiser" | "Meeting";

export type EventItem = {
    id: string;
    title: string;
    kind: EventKind;

    // Use ISO dates so the calendar can render + sort.
    // If unknown, omit dateStart and set isTbd = true.
    dateStart?: string; // "2026-01-15" or "2026-01-15T18:00"
    dateEnd?: string;

    isTbd?: boolean;

    location?: string;
    summary?: string;

    posterSrc?: string;
    posterAlt?: string;

    url?: string;
    urlLabel?: string;
};

export const events: EventItem[] = [
    {
        id: "community-meeting",
        title: "Community Meeting",
        kind: "Meeting",
        isTbd: true,
        location: "Lake Henry Pavilion",
        summary: "Project overview and Q&A. Learn how restoration funding is used.",
    },
    {
        id: "fundraising-dinner",
        title: "Fundraising Dinner",
        kind: "Fundraiser",
        isTbd: true,
        location: "Richland Center (Venue TBD)",
        summary: "Community dinner to support restoration work.",
    },
];
