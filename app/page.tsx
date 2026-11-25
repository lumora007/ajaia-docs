import DocList from "@/components/DocList";
import Header from "@/components/Header";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/documents";
import { requirePageUser } from "@/lib/session";

export default async function HomePage() {
  const user = await requirePageUser();
  const docs = await listDocuments(await getDb(), user.id);
  return (
    <>
      <Header user={user} />
      <main className="home">
        <DocList owned={docs.owned} shared={docs.shared} />
      </main>
    </>
  );
}
