import { ImageResponse } from "next/og";

export const alt = "Le jeu du Dico";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "linear-gradient(180deg, #fffbeb 0%, #ffedd5 100%)",
          color: "#7c2d12",
          fontFamily: "Avenir Next, Segoe UI, Arial, sans-serif",
        }}
      >
        <svg
          width="128"
          height="128"
          viewBox="0 0 64 64"
          style={{
            display: "flex",
            flexShrink: 0,
          }}
        >
          <defs>
            <linearGradient id="dico-og-bg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F59E0B" />
              <stop offset="1" stopColor="#EA580C" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#dico-og-bg)" />
          <rect x="18" y="14" width="4" height="36" rx="2" fill="#7C2D12" opacity="0.45" />
          <path d="M24 18H38C44.6274 18 50 23.3726 50 30V34C50 40.6274 44.6274 46 38 46H24V18Z" fill="white" opacity="0.96" />
          <path d="M31 42C37.0751 42 42 37.0751 42 31C42 24.9249 37.0751 20 31 20H24V42H31Z" fill="#FFEDD5" />
          <path d="M30 25C33.866 25 37 28.134 37 32C37 35.866 33.866 39 30 39H27V25H30Z" fill="#EA580C" />
        </svg>

        <h1
          style={{
            margin: 0,
            fontSize: 92,
            lineHeight: 1,
            fontWeight: 900,
          }}
        >
          Le jeu du Dico
        </h1>
      </div>
    ),
    {
      ...size,
    },
  );
}
