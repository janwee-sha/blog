export type FocusAreaConfig = {
    label: string;
    icon: string;
};

export type SocialLinkConfig = {
    id: string;
    name: string;
    url: string;
    icon: string;
};

export type MeConfig = {
    penName: string;
    role: string;
    avatar: string;
    bio: string;
    careerStartedAt: `${number}-${number}-${number}`;
    timeZone: string;
    status: string;
    focusAreas: FocusAreaConfig[];
    socialLinks: SocialLinkConfig[];
};
