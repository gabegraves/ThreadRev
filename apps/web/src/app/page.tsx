import { redirect } from "next/navigation";

/** The shared link lands on Analytics; Overview lives at /overview. */
export default function Page() {
  redirect("/analytics");
}
