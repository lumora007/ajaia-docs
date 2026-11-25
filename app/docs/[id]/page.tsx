import { notFound } from "next/navigation";
import DocEditor from "@/components/DocEditor";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/documents";
import { AppError } from "@/lib/errors";
import { requirePageUser } from "@/lib/session";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const doc = await getDocument(await getDb(), user.id, id).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  return <DocEditor doc={doc} user={user} />;
}
