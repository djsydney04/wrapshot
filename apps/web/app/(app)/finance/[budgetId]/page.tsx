import { redirect } from "next/navigation";

// Finance is now only accessible within projects via the Budget section
export default function BudgetDetailPage() {
  redirect("/");
}
