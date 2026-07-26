import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

export async function getCurrentSession() {
  return getAuth().api.getSession({
    headers: await headers()
  });
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
