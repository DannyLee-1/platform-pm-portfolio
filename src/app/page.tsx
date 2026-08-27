import { HomePage } from "@/components/orbit-site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Page() {
  const client = await createSupabaseServerClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  return <HomePage initialSignedIn={Boolean(data.user)} />;
}
