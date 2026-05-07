import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BriefcaseBusiness, Building2, MapPin, ShieldCheck } from "lucide-react";
import { loadCompanies } from "@/lib/data";

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = loadCompanies().find((item) => item.slug === slug);
  if (!company) notFound();

  return (
    <div className="page-stack">
      <section className="company-profile">
        <div className="profile-hero">
          <span className="eyebrow">
            <Building2 size={15} aria-hidden="true" />
            Startup profile
          </span>
          <h1>{company.name}</h1>
          <p>{company.description}</p>
          <div className="card-actions">
            {company.website && (
              <Link className="primary-button" href={company.website} target="_blank">
                Website
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            )}
            <Link className="ghost-button" href="/submit-company">
              Claim or update
            </Link>
          </div>
        </div>

        <dl className="profile-facts profile-facts--large">
          <div>
            <dt>Sector</dt>
            <dd>{company.sector}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{company.stage || "Unknown"}</dd>
          </div>
          <div>
            <dt>Employees</dt>
            <dd>{company.employees || "Unknown"}</dd>
          </div>
          <div>
            <dt>Hiring</dt>
            <dd>{company.hiringStatus.replace("_", " ")}</dd>
          </div>
          <div>
            <dt>Founded</dt>
            <dd>{company.foundedYear || "Add during claim"}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>{company.verificationStatus}</dd>
          </div>
        </dl>

        <div className="profile-panels">
          <article className="admin-panel">
            <MapPin size={20} aria-hidden="true" />
            <h2>Location</h2>
            <p>{company.address || "Utah"}</p>
          </article>
          <article className="admin-panel">
            <BriefcaseBusiness size={20} aria-hidden="true" />
            <h2>Jobs</h2>
            <p>Hiring status and job postings become editable after verification.</p>
          </article>
          <article className="admin-panel">
            <ShieldCheck size={20} aria-hidden="true" />
            <h2>Review state</h2>
            <p>Public data is seeded until a verified company representative claims this profile.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
