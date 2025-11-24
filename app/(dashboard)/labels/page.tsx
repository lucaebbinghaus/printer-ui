import ButtonGrid from "@/app/components/ButtonGrid";
import { GET as getButtonsApi } from "@/app/api/buttons/route";
import { redirect } from "next/navigation";


export default async function Page() {
  const res = await getButtonsApi();
  const buttons = await res.json();

  return (
    <div className="min-h-full bg-transparent">
      <main className="pb-10">
        <ButtonGrid buttons={buttons} />
      </main>
    </div>
  );
}
