export type PhotoStatus = "pending" | "published" | "rejected";

export type PhotoCategory =
    | "restoration"
    | "community"
    | "events"
    | "raffle"
    | "scenery";

export type PendingPhoto = {
    id: string;
    status: "pending";
    category: PhotoCategory;
    title: string;
    altSuggestion?: string;
    caption?: string;
    submittedAt: string; // ISO
    submitter?: { name?: string; email?: string };
    previewSrc: string; // for mock UI only
};

export const pendingPhotos: PendingPhoto[] = [
    {
        id: "4c9e9a2d",
        status: "pending",
        category: "restoration",
        title: "Shoreline restoration work",
        altSuggestion: "Volunteers restoring shoreline along Lake Henry",
        caption: "Spring restoration day",
        submittedAt: "2025-12-14T15:20:00Z",
        submitter: { name: "Community member", email: "example@email.com" },
        previewSrc: "/images/lakeHenryRestoration2.jpg",
    },
    {
        id: "a18f2c11",
        status: "pending",
        category: "events",
        title: "Community gathering",
        altSuggestion: "People gathered near the lake for a community event",
        caption: "Weekend meetup",
        submittedAt: "2025-12-12T18:05:00Z",
        previewSrc: "/images/lakeHenryCommunityEvents.jpg",
    },
    {
        id: "c7d0b9ef",
        status: "pending",
        category: "scenery",
        title: "Lake view at sunset",
        altSuggestion: "Sunset over Lake Henry with calm water",
        caption: "Quiet evening",
        submittedAt: "2025-12-10T22:11:00Z",
        previewSrc: "/images/lakeHenryScenery6.jpg",
    },
];
