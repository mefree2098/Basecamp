import { CompanyProfile } from "@/components/CompanyProfile";

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="page-stack">
      <CompanyProfile slug={slug} />
    </div>
  );
}
