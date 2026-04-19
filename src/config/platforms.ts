export interface Platform {
  name: string;
  url_pattern: string;
  not_found_signatures: string[];
  found_signatures: string[];
  suspended_signatures: string[];
  restricted_signatures: string[]; // Added specialized field
  confidence_weight: number;
}

export const platforms: Platform[] = [
  {
    name: "GitHub",
    url_pattern: "https://github.com/{username}",
    not_found_signatures: [
      "This is not the web page you were looking for",
      "There isn't a GitHub Pages site here",
      "404",
      "This page doesn't exist"
    ],
    found_signatures: [
      "vcard-fullname",
      "repositories-tab",
      "class=\"Counter\"",
      "Followers",
      "alt=\"@",
      "user-profile-container",
      "Profile-header"
    ],
    suspended_signatures: [
      "This account is suspended",
      "User account suspended",
      "This user account has been deleted"
    ],
    restricted_signatures: [],
    confidence_weight: 0.99
  },
  {
    name: "Instagram",
    url_pattern: "https://www.instagram.com/{username}/",
    not_found_signatures: [
      "sorry, this page isn't available",
      "The link you followed may be broken",
      "Page Not Found"
    ],
    found_signatures: [
      "ProfilePage",
      "\"username\":",
      "IG::Container"
    ],
    suspended_signatures: [
      "disabled",
      "action blocked"
    ],
    restricted_signatures: [],
    confidence_weight: 0.95
  },
  {
    name: "Twitter",
    url_pattern: "https://twitter.com/{username}",
    not_found_signatures: [
      "This account is suspended",
      "doesn't exist",
      "Account suspended"
    ],
    found_signatures: [
      "data-testid=\"tweet\"",
      "class=\"Profile\"",
      "data-user-id"
    ],
    suspended_signatures: [],
    restricted_signatures: [],
    confidence_weight: 0.96
  },
  {
    name: "LinkedIn",
    url_pattern: "https://www.linkedin.com/in/{username}",
    not_found_signatures: [
      "Profile not found",
      "This page is not available",
      "This profile is no longer available",
      "404"
    ],
    found_signatures: [
      "public_profile_top-card",
      "top-card",
      "profile-info"
    ],
    suspended_signatures: [],
    restricted_signatures: [
      "Join to view",
      "Sign in to view this profile",
      "You don't have permission to access this profile",
      "This member's activity is private"
    ],
    confidence_weight: 0.95
  },
  {
    name: "Reddit",
    url_pattern: "https://www.reddit.com/user/{username}",
    not_found_signatures: [
      "page not found",
      "this user does not exist",
      "404"
    ],
    found_signatures: [
      "UserProfile",
      "data-testid=\"user-profile-header\"",
      "karma"
    ],
    suspended_signatures: [
      "[suspended]",
      "[deleted]"
    ],
    restricted_signatures: [],
    confidence_weight: 0.92
  },
  {
    name: "Stack Overflow",
    url_pattern: "https://stackoverflow.com/users/{username}",
    not_found_signatures: [
      "User not found",
      "404"
    ],
    found_signatures: [
      "js-user-card",
      "user-details",
      "badge-tag"
    ],
    suspended_signatures: [],
    restricted_signatures: [],
    confidence_weight: 0.94
  },
  {
    name: "Telegram",
    url_pattern: "https://t.me/{username}",
    not_found_signatures: [
      "This account does not exist",
      "user not found"
    ],
    found_signatures: [
      "tgme_page",
      "tgme_header_title"
    ],
    suspended_signatures: [],
    restricted_signatures: [],
    confidence_weight: 0.80
  },
  {
    name: "TikTok",
    url_pattern: "https://www.tiktok.com/@{username}",
    not_found_signatures: [
      "Couldn't find this account",
      "This user account is private"
    ],
    found_signatures: [
      "tiktok-user",
      "user-detail-container",
      "following-count"
    ],
    suspended_signatures: [
      "account banned",
      "unavailable"
    ],
    restricted_signatures: [],
    confidence_weight: 0.88
  },
  {
    name: "YouTube",
    url_pattern: "https://www.youtube.com/@{username}",
    not_found_signatures: [
      "This channel does not exist",
      "404"
    ],
    found_signatures: [
      "ytInitialData",
      "channel-header-container",
      "subscription-button"
    ],
    suspended_signatures: [],
    restricted_signatures: [],
    confidence_weight: 0.93
  },
  {
    name: "Pinterest",
    url_pattern: "https://www.pinterest.com/{username}/",
    not_found_signatures: ["Page not found", "User not found"],
    found_signatures: ["Pinterest", "indexed-profile"],
    suspended_signatures: [],
    restricted_signatures: [],
    confidence_weight: 0.85
  }
];
