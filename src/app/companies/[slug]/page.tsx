import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Images,
  Linkedin,
  MapPin,
  ShieldCheck
} from "lucide-react";
import { getCompanyIcon } from "@/lib/companyIcons";
import { loadCompanies } from "@/lib/data";

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = loadCompanies().find((item) => item.slug === slug);
  if (!company) notFound();
  const jobPostings = company.jobPostings ?? [];
  const companyIcon = await getCompanyIcon(company);

  return (
    <div className="page-stack">
      <section className="company-profile">
        <div className="profile-hero">
          <span className="eyebrow">
            <Building2 size={15} aria-hidden="true" />
            Startup profile
          </span>
          <div className="company-profile-title">
            <span className="company-logo-gem" aria-hidden="true">
              {companyIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyIcon.url} alt="" />
              ) : (
                company.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")
              )}
            </span>
            <h1>{company.name}</h1>
          </div>
          <p>{company.description}</p>
          <div className="card-actions">
            {company.website && (
              <Link className="primary-button" href={company.website} target="_blank">
                Website
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            )}
            {company.linkedin && (
              <Link className="ghost-button" href={company.linkedin} target="_blank">
                <Linkedin size={16} aria-hidden="true" />
                LinkedIn
              </Link>
            )}
            <Link className="ghost-button" href={`/submit-company?company=${company.slug}`}>
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
            <dt>Location</dt>
            <dd>{company.location || "Utah"}</dd>
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
            {jobPostings.length > 0 ? (
              <div className="profile-job-list">
                {jobPostings.map((job) =>
                  job.url ? (
                    <Link className="profile-job-row" href={job.url} key={`${job.title}-${job.url}`} target="_blank">
                      <span>
                        <strong>{job.title}</strong>
                        <small>
                          {[job.location, job.type].filter(Boolean).join(" · ") || "Role details"}
                        </small>
                      </span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  ) : (
                    <div className="profile-job-row" key={`${job.title}-${job.location}`}>
                      <span>
                        <strong>{job.title}</strong>
                        <small>
                          {[job.location, job.type].filter(Boolean).join(" · ") || "Role details"}
                        </small>
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p>
                {company.hiringStatus === "hiring"
                  ? "This company is marked as hiring. Add live postings through a verified profile update."
                  : "Hiring status and job postings become editable after verification."}
              </p>
            )}
            {(company.jobsUrl || company.atsUrl) && (
              <Link className="text-link" href={company.atsUrl ?? company.jobsUrl ?? "#"} target="_blank">
                {company.atsUrl ? "ATS or careers feed" : "Job postings"}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            )}
          </article>
          <article className="admin-panel">
            <Images size={20} aria-hidden="true" />
            <h2>Photo gallery</h2>
            {company.gallery.length > 0 ? (
              <div className="photo-gallery">
                {company.gallery.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={photo} src={photo} alt={`${company.name} gallery item`} />
                ))}
              </div>
            ) : (
              <p>Verified companies can add office, product, and team photos during profile claim.</p>
            )}
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
