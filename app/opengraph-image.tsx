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
          position: "relative",
          background:
            "linear-gradient(135deg, rgb(255, 237, 213) 0%, rgb(254, 215, 170) 45%, rgb(251, 146, 60) 100%)",
          color: "rgb(67, 20, 7)",
          fontFamily: "Avenir Next, Segoe UI, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "48px",
            borderRadius: "36px",
            background: "rgba(255, 255, 255, 0.72)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "44px 52px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgb(146, 64, 14)",
                }}
              >
                Le jeu du Dico
              </p>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 78,
                lineHeight: 1.03,
                fontWeight: 900,
              }}
            >
              Bluffe sur des definitions
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.2,
                color: "rgb(120, 53, 15)",
              }}
            >
              Ecris, vote et gagne dans ce jeu multijoueur en francais
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 28,
              fontWeight: 700,
              color: "rgb(154, 52, 18)",
            }}
          >
            <span>5 manches</span>
            <span>•</span>
            <span>Temps reel</span>
            <span>•</span>
            <span>Mobile first</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
