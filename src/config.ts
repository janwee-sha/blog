import { meConfig } from "./me.config";
import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";
import { findSocialLink } from "./utils/me-utils";

const githubLink = findSocialLink("github");

export const siteConfig: SiteConfig = {
	title: `${meConfig.penName} 的博客`,
	subtitle: "分享知识，分享见解，分享爱好",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		{ src: "/favicon/site-icon-32.png", sizes: "32x32" },
		{ src: "/favicon/site-icon-128.png", sizes: "128x128" },
		{ src: "/favicon/site-icon-192.png", sizes: "192x192" },
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		...(githubLink
			? [
					{
						name: githubLink.name,
						url: githubLink.url,
						external: true,
					},
				]
			: []),
	],
};

export const profileConfig: ProfileConfig = {
	avatar: meConfig.avatar,
	name: meConfig.penName,
	bio: meConfig.bio,
	links: meConfig.socialLinks.map((link) => ({
		name: link.name,
		icon: link.icon,
		url: link.url,
	})),
};

export const licenseConfig: LicenseConfig = {
	enable: false,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
