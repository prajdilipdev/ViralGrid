import { FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaPinterest, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export const PLATFORM_META = {
  youtube_shorts: { name: "YouTube Shorts", Icon: FaYoutube, color: "#FF0000" },
  instagram_reels: { name: "Instagram Reels", Icon: FaInstagram, color: "#DD2A7B" },
  facebook_reels: { name: "Facebook Reels", Icon: FaFacebook, color: "#1877F2" },
  tiktok: { name: "TikTok", Icon: FaTiktok, color: "#00F2FE" },
  twitter: { name: "X (Twitter)", Icon: FaXTwitter, color: "#1DA1F2" },
  pinterest: { name: "Pinterest", Icon: FaPinterest, color: "#E60023" },
  linkedin: { name: "LinkedIn", Icon: FaLinkedin, color: "#0A66C2" },
};

export const STATUS_COLORS = {
  draft: "text-white/50 border-white/20",
  scheduled: "text-amber-400 border-amber-400/40",
  publishing: "text-blue-400 border-blue-400/40",
  published: "text-emerald-400 border-emerald-400/40",
  partial: "text-orange-400 border-orange-400/40",
  failed: "text-red-400 border-red-400/40",
};
