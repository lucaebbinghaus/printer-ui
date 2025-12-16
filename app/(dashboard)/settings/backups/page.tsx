// app/settings/backups/page.tsx
import BackupsManager from "@/app/components/BackupsManager";

export default function BackupsPage() {
  return (
    <div className="p-4 max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Backups</h1>
        <p className="mt-1 text-sm text-gray-600">
          Hier kannst du ältere Produktdaten wiederherstellen. Es werden automatisch
          bis zu 99999 Backups gespeichert.
        </p>
      </div>

      <BackupsManager />
    </div>
  );
}
