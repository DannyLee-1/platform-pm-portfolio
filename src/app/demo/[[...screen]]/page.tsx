import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrbitProduct } from "@/components/orbit-product";

const title = "ORBIT | 프로젝트 시작";
const description =
  "아이디어 등록부터 팀 매칭과 협업 시작까지 ORBIT과 함께하세요.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title,
    description,
    url: "/demo",
    siteName: "ORBIT",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ORBIT, 아이디어를 함께 만들 팀원과 연결하는 프로젝트 매칭 플랫폼",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
};

const demoScreens = new Set([
  "enter", "start", "translating", "project", "select", "invite", "register",
  "inbox", "respond", "match", "agreement", "handoff", "home", "home/projects",
  "home/invites", "profile", "notifications", "terms", "privacy",
]);

export default async function DemoPage({
  params,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  const { screen } = await params;
  const route = screen?.join("/") || "enter";
  if (!demoScreens.has(route)) notFound();
  return <OrbitProduct screen={route} demo />;
}
