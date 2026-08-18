// The Workflow Visualizer is the primary surface. Home redirects to it.
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/workflow");
}
