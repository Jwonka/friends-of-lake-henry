export type Photo = {
    src: string;
    alt: string;
    category: string;
    slug: string;
};

export const photos: Photo[] = [
    { src: "/images/lakeHenryRestoration1.jpg", alt: "Restoration work along the shoreline at Lake Henry", category: "Restoration", slug: "restoration-1" },
    { src: "/images/lakeHenryRestoration2.jpg", alt: "Volunteers supporting lake restoration efforts", category: "Restoration", slug: "restoration-2" },
    { src: "/images/lakeHenryRestoration3.jpg", alt: "Restoration progress near Lake Henry", category: "Restoration", slug: "restoration-3" },

    { src: "/images/lakeHenryDonations.jpg",  alt: "Donation support for Lake Henry restoration", category: "Donations", slug: "donation" },
    { src: "/images/lakeHenryDonations1.jpg", alt: "Community donation drive supporting the project", category: "Donations", slug: "donation-1" },
    { src: "/images/lakeHenryDonations2.jpg", alt: "Supporters contributing to restoration funding", category: "Donations", slug: "donation-2" },

    { src: "/images/lakeHenryCommunityEvents1.jpg", alt: "Community event at Lake Henry", category: "Community Events", slug: "events-1" },
    { src: "/images/lakeHenryCommunityEvents.jpg",  alt: "Neighbors gathered for a Lake Henry community event", category: "Community Events", slug: "events" },
    { src: "/images/lakeHenryCommunityEvents3.jpg", alt: "Community fundraiser event supporting Lake Henry", category: "Community Events", slug: "events-2" },

    { src: "/images/raffle.jpg",  alt: "Raffle winner photo posted by Friends of Lake Henry", category: "Raffle", slug: "raffle" },
    { src: "/images/raffle2.jpg", alt: "Raffle winner announcement and photo", category: "Raffle", slug: "raffle-1" },
    { src: "/images/raffle1.jpg", alt: "Raffle winner photo supporting restoration fundraising", category: "Raffle", slug: "raffle-2" },

    { src: "/images/lakeHenryScenery1.jpg", alt: "Lake Henry scenery", category: "Scenery", slug: "scenery-1" },
    { src: "/images/lakeHenryScenery2.jpg", alt: "Scenic view of Lake Henry", category: "Scenery", slug: "scenery-2" },
    { src: "/images/lakeHenryScenery3.jpg", alt: "Sunset scenery near Lake Henry", category: "Scenery", slug: "scenery-3" },
];