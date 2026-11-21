import AccessProof from "@/components/access-proof";
import { demoSearch } from "@/lib/demo";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoCookie, validDemoSession } from "@/lib/demo-auth";

export const dynamic = "force-dynamic";
export default async function Page() {
  if (!validDemoSession((await cookies()).get(demoCookie)?.value))
    redirect("/login");
  return <AccessProof initial={demoSearch()} />;
}
