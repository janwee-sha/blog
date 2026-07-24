import type { MeConfig } from "./types/me";

export const meConfig = {
	penName: "Janwee",
	role: "软件工程师",
	avatar: "/uploads/2026/07/cat.jpg",
	bio: "知者行之始，行者知之成",
	careerStartedAt: "2019-07-01",
	timeZone: "Asia/Shanghai",
	status: "持续学习中",
	focusAreas: [
		{
			label: "软件开发",
			icon: "fa6-solid:code",
		},
		{
			label: "技术写作",
			icon: "fa6-regular:pen-to-square",
		},
		{
			label: "保持好奇",
			icon: "fa6-regular:lightbulb",
		},
	],
	socialLinks: [
		{
			id: "github",
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/janwee-sha",
		},
	],
} satisfies MeConfig;
