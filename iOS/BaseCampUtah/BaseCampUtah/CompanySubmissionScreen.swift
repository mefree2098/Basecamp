import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct CompanySubmissionScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @State private var form = CompanyDraftInput.empty
    @State private var status = ""
    @State private var ingestStatus = ""
    @State private var uploadStatus = ""
    @State private var photos: [PhotosPickerItem] = []
    @State private var pendingImages: [PickedImage] = []
    @State private var submitting = false

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 820
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if compact {
                        formPanel
                        verificationPanel
                    } else {
                        HStack(alignment: .top, spacing: 16) {
                            formPanel
                            verificationPanel
                                .frame(width: 330)
                        }
                    }
                }
                .padding(compact ? 16 : 22)
            }
            .onAppear(perform: applyPrefill)
            .onChange(of: store.companyDraftPrefillSlug) { _, _ in
                applyPrefill()
            }
            .onChange(of: photos) { _, newItems in
                Task { await loadPickedPhotos(newItems) }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Self-service profile", systemImage: "building.2")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(palette.cyan)
            Text("Claim or create a company profile")
                .font(.system(size: 32, weight: .black))
                .foregroundStyle(palette.text)
            Text(status.isEmpty ? "Submit rich company data, jobs, gallery URLs, and work-email verification details." : status)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(status.lowercased().contains("error") ? palette.red : palette.muted)
        }
    }

    private var formPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 13) {
                Text("Company details")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                field("Company name", text: $form.name)
                HStack(spacing: 10) {
                    field("Website", text: $form.website)
                    field("Work email", text: $form.workEmail)
                }
                HStack(spacing: 10) {
                    field("Sector", text: $form.sector)
                    field("Stage", text: $form.stage)
                }
                HStack(spacing: 10) {
                    field("Employees", text: $form.employees)
                    field("Year founded", text: $form.foundedYear)
                }
                field("Full address", text: $form.address)
                field("LinkedIn", text: $form.linkedin)
                HStack(spacing: 10) {
                    field("Job postings URL", text: $form.jobsUrl)
                    field("ATS or careers feed URL", text: $form.atsUrl)
                }
                Button {
                    Task { await importJobs() }
                } label: {
                    Label("Import jobs", systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(NeonButtonStyle())
                .disabled(form.atsUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if !ingestStatus.isEmpty {
                    Text(ingestStatus)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(palette.muted)
                }
                textArea("Description", text: $form.description, minHeight: 110)
                textArea("Job postings", text: $form.jobPostings, minHeight: 96)
                textArea("Photo gallery URLs", text: $form.gallery, minHeight: 88)
                PhotosPicker(selection: $photos, maxSelectionCount: 12, matching: .images) {
                    Label("Select gallery photos", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle(tint: palette.blue))
                if !pendingImages.isEmpty {
                    Button {
                        Task { await uploadPhotos() }
                    } label: {
                        Label("Upload \(pendingImages.count) photo\(pendingImages.count == 1 ? "" : "s")", systemImage: "icloud.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeonButtonStyle(tint: palette.green, filled: true))
                }
                if !uploadStatus.isEmpty {
                    Text(uploadStatus)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(palette.muted)
                }
                Picker("Hiring status", selection: $form.hiringStatus) {
                    Text("Unknown").tag(HiringStatus.unknown)
                    Text("Hiring").tag(HiringStatus.hiring)
                    Text("Not hiring").tag(HiringStatus.notHiring)
                }
                .pickerStyle(.segmented)
                Button {
                    Task { await submit() }
                } label: {
                    Label(submitting ? "Submitting" : "Submit for review", systemImage: "paperplane.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle(tint: palette.cyan, filled: true))
                .disabled(form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || submitting)
            }
        }
    }

    private var verificationPanel: some View {
        VStack(spacing: 14) {
            GlassPanel {
                VStack(alignment: .leading, spacing: 12) {
                    Image(systemName: "checkmark.shield")
                        .font(.system(size: 30, weight: .black))
                        .foregroundStyle(palette.green)
                    Text("Verification path")
                        .font(.system(size: 20, weight: .black))
                        .foregroundStyle(palette.text)
                    Text("Basecamp sends a magic link to a work email, checks that the email domain matches the company website, then queues the draft for admin review.")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(palette.muted)
                        .lineSpacing(3)
                    VStack(alignment: .leading, spacing: 8) {
                        Pill(title: form.workEmail.isEmpty ? "Email needed" : "Work email", symbol: "envelope", tint: palette.cyan)
                        Pill(title: form.website.isEmpty ? "Website needed" : "Domain check", symbol: "globe", tint: palette.blue)
                        Pill(title: "Admin review", symbol: "shield", tint: palette.purple)
                    }
                }
            }
            if let company = store.companies.first(where: { $0.slug == form.companySlug }), !form.companySlug.isEmpty {
                CompanyDetailPanel(company: company, compact: true)
            }
        }
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(palette.muted)
            TextField(title, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .fieldChrome()
        }
    }

    private func textArea(_ title: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(palette.muted)
            TextField(title, text: text, axis: .vertical)
                .lineLimit(4...9)
                .padding(12)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .foregroundStyle(palette.text)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(palette.panelStrong.opacity(0.76))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                )
        }
    }

    private func applyPrefill() {
        guard !store.companyDraftPrefillSlug.isEmpty,
              let company = store.companies.first(where: { $0.slug == store.companyDraftPrefillSlug }) else {
            return
        }
        form.companySlug = company.slug
        form.name = company.name
        form.website = company.website ?? ""
        form.sector = company.sector ?? ""
        form.stage = company.stage ?? ""
        form.employees = company.employees ?? ""
        form.address = company.address
        form.description = company.description
        form.linkedin = company.linkedin ?? ""
        form.foundedYear = company.foundedYear.map(String.init) ?? ""
        form.hiringStatus = company.hiringStatus
        form.jobsUrl = company.jobsUrl ?? ""
        form.atsUrl = company.atsUrl ?? ""
        form.jobPostings = (company.jobPostings ?? []).map(formatJob).joined(separator: "\n")
        form.gallery = company.gallery.joined(separator: "\n")
        status = "Loaded \(company.name) for profile updates."
    }

    private func importJobs() async {
        ingestStatus = "Importing jobs..."
        do {
            let jobs = try await store.previewATSJobs(url: form.atsUrl)
            if jobs.isEmpty {
                ingestStatus = "No jobs found at that URL."
                return
            }
            form.jobPostings = ([form.jobPostings.trimmingCharacters(in: .whitespacesAndNewlines)] + jobs.map(formatJob))
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
            ingestStatus = "Imported \(jobs.count) job\(jobs.count == 1 ? "" : "s")."
        } catch {
            ingestStatus = store.userFacing(error)
        }
    }

    private func loadPickedPhotos(_ items: [PhotosPickerItem]) async {
        var images: [PickedImage] = []
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let type = item.supportedContentTypes.first ?? .jpeg
            let ext = type.preferredFilenameExtension ?? "jpg"
            images.append(
                PickedImage(
                    filename: "basecamp-gallery-\(UUID().uuidString).\(ext)",
                    mimeType: type.preferredMIMEType ?? "image/jpeg",
                    data: data
                )
            )
        }
        pendingImages = images
        uploadStatus = images.isEmpty ? "No usable image data was selected." : "Ready to upload \(images.count) photo\(images.count == 1 ? "" : "s")."
    }

    private func uploadPhotos() async {
        uploadStatus = "Uploading photos..."
        do {
            let urls = try await store.uploadGallery(images: pendingImages)
            form.gallery = ([form.gallery.trimmingCharacters(in: .whitespacesAndNewlines)] + urls)
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
            pendingImages = []
            photos = []
            uploadStatus = "Uploaded \(urls.count) photo\(urls.count == 1 ? "" : "s")."
        } catch {
            uploadStatus = store.userFacing(error)
        }
    }

    private func submit() async {
        submitting = true
        status = "Submitting draft..."
        defer { submitting = false }
        do {
            let result = try await store.submitCompanyDraft(form)
            if result.magicLinkSent == true {
                status = "Draft \(result.id ?? "") queued. Check \(form.workEmail) for the verification link."
            } else {
                status = "Draft \(result.id ?? "") queued for review. \(result.domainMatch?.reason ?? "Manual verification is required.")"
            }
        } catch {
            status = store.userFacing(error)
        }
    }

    private func formatJob(_ job: JobPosting) -> String {
        [job.title, job.location ?? "", job.url ?? "", job.type ?? ""].joined(separator: " | ")
    }
}
