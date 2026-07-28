import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Growlogue",
    short_name: "Growlogue",
    description: "今日の行動を、成長物語へ。",
    id: "/",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2e8",
    theme_color: "#173f35",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
