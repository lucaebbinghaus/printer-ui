import TopBar from "./components/TopBar";
import ButtonGrid from "./components/ButtonGrid";
import { GET as getButtonsApi } from "./api/buttons/route";


export default async function Page() {
  const res = await getButtonsApi();
  const buttons = await res.json();

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Printer 1" />
      <main className="pb-10">
        <ButtonGrid buttons={buttons} />
      </main>
    </div>
  );
}
