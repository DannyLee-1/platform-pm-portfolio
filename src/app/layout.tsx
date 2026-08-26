import type { Metadata } from "next";
import "./globals.css";
import "./product.css";
import "./polish.css";

const loginlessBuild = process.env.NEXT_PUBLIC_ORBIT_LOGINLESS === "1";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://portfolio-dannylee.vercel.app";
const productTitle = loginlessBuild
  ? "ORBIT | 아이디어에서 팀까지"
  : "ORBIT | 함께 만들 팀원을 잇습니다";
const title = `${productTitle} · 이승주 플랫폼 PM 포트폴리오`;
const description =
  "양면 사용자의 정보 비대칭을 해결하는 팀빌딩 매칭 플랫폼. 이승주 PM이 문제 정의부터 사용자 여정, 운영 정책, MVP 구현과 배포까지 완성한 포트폴리오입니다.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "ORBIT",
  title,
  description,
  authors: [{ name: "이승주" }],
  creator: "이승주",
  keywords: [
    "플랫폼 PM",
    "Product Manager",
    "서비스 기획",
    "양면 플랫폼",
    "매칭 플랫폼",
    "MVP",
    "ORBIT",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "ORBIT",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
