/* eslint-disable @next/next/no-img-element -- ImageResponse requires standard img elements. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt =
  "이승주 플랫폼 PM 포트폴리오, 아이디어를 함께 만들 팀원과 연결하는 ORBIT";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [backgroundData, logoData] = await Promise.all([
    readFile(join(process.cwd(), "public/orbit/deep-field.png"), "base64"),
    readFile(
      join(process.cwd(), "public/orbit/orbit-logo-light-2x.png"),
      "base64",
    ),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          backgroundColor: "#050817",
          color: "#eef3ff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <img
          alt=""
          src={`data:image/png;base64,${backgroundData}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(3, 6, 20, 0.9) 0%, rgba(4, 10, 27, 0.56) 56%, rgba(3, 8, 22, 0.3) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "34px",
            display: "flex",
            border: "1px solid rgba(192, 207, 255, 0.24)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "72px 82px 68px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#aebddf",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                display: "flex",
                width: 34,
                height: 2,
                marginRight: 14,
                backgroundColor: "#4d82ff",
              }}
            />
            PROJECT MATCHING PLATFORM
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <img
              alt="ORBIT"
              src={`data:image/png;base64,${logoData}`}
              style={{
                width: 650,
                height: 190,
                objectFit: "contain",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 46,
                color: "#ffffff",
                fontSize: 31,
                fontWeight: 700,
              }}
            >
              IDEA
              <span
                style={{
                  display: "flex",
                  margin: "0 20px",
                  color: "#4d82ff",
                  fontSize: 26,
                }}
              >
                →
              </span>
              ROLE
              <span
                style={{
                  display: "flex",
                  margin: "0 20px",
                  color: "#4d82ff",
                  fontSize: 26,
                }}
              >
                →
              </span>
              TEAM
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              color: "#aebddf",
              fontSize: 18,
            }}
          >
            <span>PLATFORM PM PORTFOLIO · LEE SEUNGJOO</span>
            <span style={{ color: "#dbe5ff" }}>orbit · project together</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
