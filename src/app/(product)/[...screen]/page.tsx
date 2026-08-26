import { notFound, redirect } from "next/navigation";
import { OrbitProduct } from "@/components/orbit-product";

const screens = new Set([
  "login", "signup", "enter", "start", "translating", "project", "select", "invite",
  "register", "inbox", "respond", "match", "agreement", "handoff", "home",
  "home/projects", "home/invites", "profile", "notifications", "terms",
  "privacy",
]);

export default async function ProductPage({ params }: PageProps<"/[...screen]">) {
  const { screen } = await params;
  const route = screen.join("/");
  if (!screens.has(route)) notFound();
  const loginlessBuild = process.env.NEXT_PUBLIC_ORBIT_LOGINLESS === "1";
  if (loginlessBuild && (route === "login" || route === "signup")) {
    redirect("/enter");
  }
  return (
    <OrbitProduct
      screen={route}
      demo={loginlessBuild}
      demoBasePath={loginlessBuild ? "" : undefined}
    />
  );
}
