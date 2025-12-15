export type DonorItem = {
    name: string;
    note: string;
};

export const donors: DonorItem[] = [
    { name: "Community donors", note: "Thank you for supporting the lake." },
    { name: "Local sponsors", note: "Businesses and organizations backing restoration." },
    { name: "In-kind support", note: "Volunteers, supplies, and services donated to the project." },
];