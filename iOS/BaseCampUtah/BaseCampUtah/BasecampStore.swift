import Combine
import Foundation
import SwiftUI

@MainActor
final class BasecampStore: ObservableObject {
    @Published var settings: AppSettings
    @Published var selectedSection: AppSection = .map
    @Published var platform: PlatformBootstrapResponse?
    @Published var mapData: MapBootstrapResponse?
    @Published var auth: AuthSessionResponse = AuthSessionResponse(user: nil, notifications: [], unreadCount: 0)
    @Published var founderSessions: [FounderSession] = []
    @Published var adminSummary: AdminSummaryResponse?
    @Published var publicImportPreview: PublicCompanyImportPreview?
    @Published var adminIntegrations: AdminIntegrationSettings?
    @Published var health: HealthResponse?
    @Published var status: String = "Ready"
    @Published var lastSyncedAt: Date?
    @Published var isRefreshing = false
    @Published var companyDraftPrefillSlug = ""

    private let cache = CacheStore()

    init() {
        self.settings = cache.loadSettings()
        if let cached = cache.loadBootstrap(), cached.serverURL == settings.serverURL {
            self.platform = cached.platform
            self.mapData = cached.map
            self.auth = cached.auth ?? AuthSessionResponse(user: nil, notifications: [], unreadCount: 0)
            self.founderSessions = cached.sessions
            self.lastSyncedAt = cached.savedAt
        }
    }

    var api: BasecampAPI? {
        try? BasecampAPI(serverURL: settings.serverURL)
    }

    var resources: [Resource] {
        platform?.resources ?? []
    }

    var companies: [Company] {
        mapData?.companies ?? []
    }

    func bootstrap() async {
        guard platform == nil || mapData == nil else {
            await refreshCoreData(silent: true)
            return
        }
        await refreshCoreData(silent: false)
    }

    func updateSettings(_ next: AppSettings) {
        settings = next
        cache.saveSettings(next)
    }

    func updateServerURL(_ url: String) async {
        var next = settings
        next.serverURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        updateSettings(next)
        await refreshCoreData(silent: false)
    }

    func setTheme(_ theme: BasecampTheme) {
        var next = settings
        next.theme = theme
        updateSettings(next)
    }

    func setShowExtraMapData(_ show: Bool) {
        var next = settings
        next.showExtraMapData = show
        updateSettings(next)
    }

    func setAiSettings(_ aiSettings: AiSettings) {
        var next = settings
        next.aiSettings = aiSettings
        updateSettings(next)
    }

    func refreshCoreData(silent: Bool) async {
        guard let api else {
            status = "Server URL is not valid."
            return
        }
        if !silent {
            status = "Syncing Basecamp..."
        }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let platformResponse: PlatformBootstrapResponse = try await api.get("/api/platform/bootstrap")
            let mapResponse: MapBootstrapResponse = try await api.get("/api/map/bootstrap")
            let authResponse: AuthSessionResponse = try await api.get("/api/auth/session")
            platform = platformResponse
            mapData = mapResponse
            auth = authResponse
            if let user = authResponse.user {
                founderSessions = try await loadFounderSessions(userId: user.id)
            } else {
                founderSessions = []
            }
            try? await refreshHealth()
            let now = Date()
            lastSyncedAt = now
            status = "Synced \(Self.timeFormatter.string(from: now))"
            saveBootstrapCache()
        } catch {
            status = userFacing(error)
        }
    }

    func refreshHealth() async throws {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        health = try await api.get("/api/healthz")
    }

    func clearCache() {
        cache.clearBootstrap()
        platform = nil
        mapData = nil
        founderSessions = []
        adminSummary = nil
        publicImportPreview = nil
        adminIntegrations = nil
        lastSyncedAt = nil
        status = "Local cache cleared."
    }

    func signIn(provider: AuthProviderID, name: String?, email: String?) async throws {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        let response: SignInResponse = try await api.post(
            "/api/auth/sign-in",
            body: SignInRequest(provider: provider, name: name, email: email, avatarUrl: nil)
        )
        auth = AuthSessionResponse(
            user: response.user,
            notifications: response.notifications,
            unreadCount: response.unreadCount
        )
        if let sessions = response.sessions {
            founderSessions = sessions
        } else if let user = response.user {
            founderSessions = try await loadFounderSessions(userId: user.id)
        } else {
            founderSessions = []
        }
        saveBootstrapCache()
    }

    func signOut() async {
        guard let api else { return }
        do {
            let _: EmptyResponse = try await api.post("/api/auth/sign-out")
        } catch {
            status = userFacing(error)
        }
        auth = AuthSessionResponse(user: nil, notifications: [], unreadCount: 0)
        founderSessions = []
        saveBootstrapCache()
    }

    func markNotificationsRead(ids: [String]? = nil) async {
        guard let api else { return }
        do {
            let response: NotificationReadResponse = try await api.post(
                "/api/auth/notifications/read",
                body: ["ids": ids ?? []]
            )
            auth.notifications = response.notifications
            auth.unreadCount = response.unreadCount
        } catch {
            status = userFacing(error)
        }
    }

    func loadFounderSessions(userId: String) async throws -> [FounderSession] {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        let response: FounderSessionsResponse = try await api.get(
            "/api/founder-sessions",
            query: [URLQueryItem(name: "userId", value: userId)]
        )
        return response.sessions
    }

    func refreshFounderSessions() async {
        guard let user = auth.user else { return }
        do {
            founderSessions = try await loadFounderSessions(userId: user.id)
            saveBootstrapCache()
        } catch {
            status = userFacing(error)
        }
    }

    func sendWizardMessage(
        message: String,
        profile: FounderProfile,
        session: FounderSession?,
        completedSteps: [String]
    ) async throws -> WizardResponse {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        let context = session.map {
            SessionContext(
                sessionId: $0.id,
                completedSteps: completedSteps,
                currentPlanCards: $0.planCards,
                previousAssistantMessage: $0.turns.last?.assistantMessage,
                history: $0.turns.suffix(6).map {
                    SessionContextTurn(
                        userMessage: $0.userMessage,
                        assistantMessage: $0.assistantMessage,
                        completedSteps: $0.completedSteps
                    )
                }
            )
        }
        return try await api.post(
            "/api/ai/chat",
            body: WizardChatRequest(
                settings: settings.aiSettings,
                profile: profile,
                message: message,
                sessionContext: context
            )
        )
    }

    func fallbackRecommendations(
        profile: FounderProfile,
        limit: Int,
        orderedIds: [String] = []
    ) async throws -> RecommendationResponse {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        return try await api.post(
            "/api/recommendations",
            body: RecommendationRequest(profile: profile, limit: limit, orderedIds: orderedIds)
        )
    }

    func persistFounderTurn(
        sessionId: String?,
        profile: FounderProfile,
        userMessage: String,
        response: WizardResponse,
        completedSteps: [String]
    ) async throws -> FounderSession {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        guard let user = auth.user else { throw BasecampAPIError.server(status: 401, message: "Create a profile to save this turn.") }
        let result: FounderSessionResponse = try await api.post(
            "/api/founder-sessions",
            body: SaveFounderTurnRequest(
                userId: user.id,
                sessionId: sessionId,
                profile: profile,
                userMessage: userMessage,
                assistantMessage: response.assistantMessage,
                usedProvider: response.usedProvider,
                planCards: response.planCards,
                completedSteps: completedSteps,
                recommendationIds: response.recommendations.map(\.resource.id)
            )
        )
        await refreshFounderSessions()
        return result.session
    }

    func updateFounderProgress(sessionId: String, completedSteps: [String]) async throws -> FounderSession {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        guard let user = auth.user else { throw BasecampAPIError.server(status: 401, message: "Create a profile to save progress.") }
        let result: FounderSessionResponse = try await api.patch(
            "/api/founder-sessions",
            body: UpdateFounderProgressRequest(
                userId: user.id,
                sessionId: sessionId,
                completedSteps: completedSteps
            )
        )
        await refreshFounderSessions()
        return result.session
    }

    func searchResources(
        q: String,
        stage: String,
        topic: String,
        county: String,
        industry: String,
        limit: Int
    ) async throws -> ResourceListResponse {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        var query = [URLQueryItem(name: "limit", value: "\(limit)")]
        appendQuery(&query, name: "q", value: q)
        appendQuery(&query, name: "stage", value: stage)
        appendQuery(&query, name: "topic", value: topic)
        appendQuery(&query, name: "county", value: county)
        appendQuery(&query, name: "industry", value: industry)
        return try await api.get("/api/resources", query: query)
    }

    func searchCompanies(
        q: String,
        sector: String,
        stage: String,
        employees: String,
        location: String,
        hiring: String,
        limit: Int
    ) async throws -> CompanyListResponse {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        var query = [URLQueryItem(name: "limit", value: "\(limit)")]
        appendQuery(&query, name: "q", value: q)
        appendQuery(&query, name: "sector", value: sector)
        appendQuery(&query, name: "stage", value: stage)
        appendQuery(&query, name: "employees", value: employees)
        appendQuery(&query, name: "location", value: location)
        appendQuery(&query, name: "hiring", value: hiring)
        return try await api.get("/api/companies", query: query)
    }

    func submitCompanyDraft(_ input: CompanyDraftInput) async throws -> CompanyDraftSubmissionResponse {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        return try await api.post("/api/company-drafts", body: input)
    }

    func previewATSJobs(url: String) async throws -> [JobPosting] {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        let response: ATSPreviewResponse = try await api.post("/api/ats/preview", body: ATSPreviewRequest(url: url))
        return response.jobs ?? []
    }

    func uploadGallery(images: [PickedImage]) async throws -> [String] {
        guard let api else { throw BasecampAPIError.invalidServerURL }
        let response = try await api.uploadGallery(images: images)
        return response.urls ?? []
    }

    func refreshAdmin() async {
        guard let api else { return }
        do {
            adminSummary = try await api.get("/api/admin/summary")
            publicImportPreview = try await api.get("/api/admin/public-company-import")
            adminIntegrations = try await api.get("/api/admin/integrations")
        } catch {
            status = userFacing(error)
        }
    }

    func reviewDraft(id: String, action: String) async {
        guard let api else { return }
        do {
            let _: DraftReviewResponse = try await api.patch(
                "/api/company-drafts",
                body: CompanyDraftReviewRequest(id: id, action: action, reviewerNote: nil)
            )
            await refreshAdmin()
            await refreshCoreData(silent: true)
            status = action == "approve" ? "Draft approved and published." : "Draft rejected."
        } catch {
            status = userFacing(error)
        }
    }

    func importAdminCSV(kind: String, csv: String) async {
        guard let api else { return }
        do {
            let response: AdminImportResponse = try await api.post(
                "/api/admin/imports",
                body: AdminImportRequest(kind: kind, csv: csv)
            )
            status = "Imported \(response.count ?? 0) \(kind)."
            await refreshAdmin()
            await refreshCoreData(silent: true)
        } catch {
            status = userFacing(error)
        }
    }

    func importPublicCompanies(limit: Int) async {
        guard let api else { return }
        do {
            publicImportPreview = try await api.post(
                "/api/admin/public-company-import",
                body: PublicCompanyImportRequest(limit: limit)
            )
            status = "Imported \(publicImportPreview?.importedCount ?? 0) public records."
            await refreshAdmin()
            await refreshCoreData(silent: true)
        } catch {
            status = userFacing(error)
        }
    }

    func updateIntegrations(_ patch: GoogleMapsPatch) async {
        guard let api else { return }
        do {
            adminIntegrations = try await api.patch(
                "/api/admin/integrations",
                body: IntegrationPatchRequest(googleMaps: patch)
            )
            status = "Map integration settings saved."
            await refreshCoreData(silent: true)
        } catch {
            status = userFacing(error)
        }
    }

    func resolvedURL(_ path: String?) -> URL? {
        api?.absoluteURL(for: path)
    }

    func userFacing(_ error: Error) -> String {
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            return description
        }
        return error.localizedDescription
    }

    private func saveBootstrapCache() {
        cache.saveBootstrap(
            BootstrapCache(
                savedAt: lastSyncedAt ?? Date(),
                serverURL: settings.serverURL,
                platform: platform,
                map: mapData,
                auth: auth,
                sessions: founderSessions
            )
        )
    }

    private func appendQuery(_ query: inout [URLQueryItem], name: String, value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            query.append(URLQueryItem(name: name, value: trimmed))
        }
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()
}

struct DraftReviewResponse: Codable {
    var draft: CompanyDraftSummary?
    var company: Company?
}
