export type RaffleWinner = { name: string; prize: string; date: string };

export const raffleConfig = {
    // Public raffle calendar metadata
    monthName: "November",
    year: 2025,
    monthIndex: 10, // 0=Jan ... 10=Nov
    ticketPrice: 100,

    flyerMeta: {
        subtitle: "30 Day Giveaway",
        orgLine: "Friends of Lake Henry",
        address: "P.O. Box 142, Blair, WI 54616",
        phone: "608-484-9241",
    },

    rules: [
        "Drawing at 6pm EVERYDAY in November.",
        "All proceeds go to Lake Henry Project.",
        "If drawn, name goes in for remaining drawings.",
        'Every firearm has a minimum value of $1000; $800 cash option if you do not choose the firearm.',
        "All State & Federal laws apply; MUST be 21 or older to purchase a ticket.",
    ],

    // Keep as an array so ordering is stable and serializable
    prizesByDay: [
        { day: 1, prize: "Ruger SR1911 Commander .45 Auto Semi-Automatic Pistol" },
        { day: 2, prize: "Browning X-Bolt Stalker 7mm Rem Mag Bolt Action Rifle" },
        { day: 3, prize: "Savage 110 High Country 30-06 Bolt Action Rifle" },
        { day: 4, prize: "Bergara HMR 300 Win Mag Bolt Action Rifle" },
        { day: 5, prize: "Tikka T3X Hunter 7mm Rem Mag Bolt Action Rifle" },
        { day: 6, prize: "Ruger SR1911 Commander .45 Auto Semi-Automatic Pistol" },
        { day: 7, prize: "Metro Arms 1911 American Classic Trophy .45 Auto Pistol" },
        { day: 8, prize: 'Henry Big Boy Steel All Weather Side Gate .44 Mag Lever Action Rifle' },
        { day: 9, prize: "Browning X-Bolt Western Hunter LR (6.8mm Western) Rifle" },
        { day: 10, prize: "Weatherby Vanguard First Lite Specter 7mm Rem Mag Rifle" },
        { day: 11, prize: "Henry Side Gate 45-70 Govt Rifle" },
        { day: 12, prize: "Bergara HMR 6.5 Creedmoor Rifle" },
        { day: 13, prize: "Auto-Ordnance 1911 A1 Tanker .45 ACP Pistol" },
        { day: 14, prize: "Browning X-Bolt Stalker .270 Win Rifle" },
        { day: 15, prize: "Springfield Armory 1911 Emissary 9mm Pistol" },
        { day: 16, prize: "Winchester 1892 Carbine .357 Mag Lever Action Rifle" },
        { day: 17, prize: "Browning X-Bolt Hunter .243 Win Bolt Action Rifle" },
        { day: 18, prize: "Kimber Stainless II 1911 .38 Super Auto +P Pistol" },
        { day: 19, prize: 'Cimarron 1892 Short Rifle .357 Mag 20" Lever Action Rifle' },
        { day: 20, prize: 'Savage 110 Long Range Hunter .338 Lapua Mag 26" Bolt Action Rifle' },
        { day: 21, prize: "Kimber Camp Guard 10 1911 10mm Semi-Auto Pistol" },
        { day: 22, prize: "Ruger Hawkeye Predator 22-250 Bolt Action Rifle" },
        { day: 23, prize: "Henry .410 Side Gate Lever Action Shotgun" },
        { day: 24, prize: 'Smith & Wesson 500 Mag 8.375" 5-Round Revolver' },
        { day: 25, prize: "Ruger New Vaquero .45 Colt Revolver" },
        { day: 26, prize: "Auto-Ordnance M1 Carbine .30 Carbine Semi-Auto Rifle" },
        { day: 27, prize: "EAA Girsan MC 1911 Match LUX .45 Auto Pistol" },
        { day: 28, prize: "Christensen Arms Mesa FFT 7mm Rem Mag Bolt Action Rifle" },
        { day: 29, prize: 'Winchester M94 Sporter 38-55 Win 24" Lever Action Rifle' },
        { day: 30, prize: "Charles Daly Triple Threat .410 Triple Barrel Shotgun" },
    ],

    // Banner + admin settings (mock for now)
    banner: {
        isActive: true,
        message: "Raffle tickets available — support Lake Henry restoration.",
        cta: "Click here",
        url: "/raffle",
        drawDate: "2026-02-01",
        winners: [
            { name: "Jane D.", prize: "Kayak", date: "2025-11-10" },
            { name: "Mike R.", prize: "Gift basket", date: "2025-10-02" },
        ] satisfies RaffleWinner[],
    },
} as const;
