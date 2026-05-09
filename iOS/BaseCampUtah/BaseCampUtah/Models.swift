import CoreLocation
import Foundation
import SwiftUI

enum AppSection: String, CaseIterable, Identifiable, Codable {
    case map
    case resources
    case wizard
    case companies
    case admin
    case profile
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .map: "Map"
        case .resources: "Resources"
        case .wizard: "Founder Wizard"
        case .companies: "Companies"
        case .admin: "Admin"
        case .profile: "Profile"
        case .settings: "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .map: "mappin.and.ellipse"
        case .resources: "book.pages"
        case .wizard: "sparkles"
        case .companies: "building.2"
        case .admin: "shield.lefthalf.filled"
        case .profile: "person.crop.circle"
        case .settings: "gearshape"
        }
    }
}

enum BasecampTheme: String, CaseIterable, Identifiable, Codable {
    case tech
    case classic

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tech: "Tech"
        case .classic: "Classic"
        }
    }
}

enum FounderStage: String, CaseIterable, Identifiable, Codable {
    case idea
    case validate
    case start
    case grow
    case fund
    case exit

    var id: String { rawValue }

    var title: String {
        switch self {
        case .idea: "Idea"
        case .validate: "Validate"
        case .start: "Start"
        case .grow: "Grow"
        case .fund: "Fund"
        case .exit: "Exit"
        }
    }
}

enum FounderMode: String, Codable {
    case chat
    case guided
    case manual
}

enum HiringStatus: String, Codable {
    case unknown
    case hiring
    case notHiring = "not_hiring"

    var label: String {
        switch self {
        case .unknown: "Unknown"
        case .hiring: "Hiring Now"
        case .notHiring: "Not hiring"
        }
    }
}

enum VerificationStatus: String, Codable {
    case seeded
    case claimed
    case pending

    var label: String {
        switch self {
        case .seeded: "Seeded"
        case .claimed: "Verified"
        case .pending: "Pending"
        }
    }
}

struct FounderProfile: Codable, Hashable {
    var stage: FounderStage
    var industry: String
    var county: String
    var community: String
    var goal: String
    var mode: FounderMode

    static let empty = FounderProfile(
        stage: .start,
        industry: "Technology",
        county: "Salt Lake",
        community: "Salt Lake City",
        goal: "I want to turn an idea into a real Utah business. What should I do first?",
        mode: .chat
    )
}

struct Freshness: Codable, Hashable {
    var status: String
    var reviewedAt: String?
    var note: String?
}

struct Resource: Codable, Identifiable, Hashable {
    var id: String
    var slug: String
    var title: String
    var description: String
    var communities: [String]
    var industries: [String]
    var locations: [String]
    var topics: [String]
    var stages: [FounderStage]
    var link: String
    var email: String?
    var freshness: Freshness
}

struct Company: Codable, Identifiable, Hashable {
    var slug: String
    var name: String
    var displayType: String?
    var linkedin: String?
    var address: String
    var location: String
    var description: String
    var website: String?
    var stage: String?
    var employees: String?
    var sector: String?
    var hiringStatus: HiringStatus
    var foundedYear: Int?
    var jobsUrl: String?
    var atsUrl: String?
    var jobPostings: [JobPosting]?
    var gallery: [String]
    var coordinates: CompanyCoordinates
    var verificationStatus: VerificationStatus
    var source: CompanySourceMetadata?

    var id: String { slug }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: coordinates.lat, longitude: coordinates.lng)
    }

    var isSeedRecord: Bool {
        source == nil
    }
}

struct JobPosting: Codable, Identifiable, Hashable {
    var title: String
    var location: String?
    var url: String?
    var type: String?

    var id: String {
        [title, location ?? "", url ?? "", type ?? ""].joined(separator: "|")
    }
}

struct CompanyCoordinates: Codable, Hashable {
    var lat: Double
    var lng: Double
    var confidence: String
}

struct CompanySourceMetadata: Codable, Hashable {
    var id: String
    var name: String
    var url: String
    var sourceRecordId: String?
    var fetchedAt: String?
    var license: String?
    var note: String?
}

struct Facet: Codable, Identifiable, Hashable {
    var label: String
    var count: Int
    var id: String { label }
}

struct PlatformFacets: Codable, Hashable {
    var stages: [Facet]
    var topics: [Facet]
    var counties: [Facet]
    var industries: [Facet]
    var communities: [Facet]
    var sectors: [Facet]
    var companyStages: [Facet]
    var employeeBands: [Facet]
    var companyLocations: [Facet]

    static let empty = PlatformFacets(
        stages: [],
        topics: [],
        counties: [],
        industries: [],
        communities: [],
        sectors: [],
        companyStages: [],
        employeeBands: [],
        companyLocations: []
    )
}

struct PageInfo: Codable, Hashable {
    var totalApprox: Int
    var hasNextPage: Bool
    var cursor: String?
}

struct ResourceListResponse: Codable {
    var items: [Resource]
    var facets: PlatformFacets
    var page: PageInfo
}

struct CompanyListResponse: Codable {
    var items: [Company]
    var facets: PlatformFacets
    var page: PageInfo
}

struct CompanyMapLocation: Codable, Hashable {
    var lat: Double
    var lng: Double
    var confidence: String
    var formattedAddress: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct CompanyIconView: Codable, Hashable {
    var url: String
    var source: String?
    var fetchedAt: String?
}

struct PlatformBootstrapResponse: Codable {
    var resources: [Resource]
    var facets: PlatformFacets
    var founderOptions: FounderOptions
}

struct FounderOptions: Codable {
    var industries: [String]
    var counties: [String]
    var communities: [String]
}

struct MapBootstrapResponse: Codable {
    var companies: [Company]
    var facets: PlatformFacets
    var geocodedLocations: [String: CompanyMapLocation]
    var companyIcons: [String: CompanyIconView]
    var integrations: ClientIntegrationSettings
}

struct ClientIntegrationSettings: Codable {
    var googleMaps: GoogleMapsClientSettings
}

struct GoogleMapsClientSettings: Codable {
    var browserApiKey: String
    var mapId: String
    var techMapId: String
    var hasServerGeocodingKey: Bool
}

struct CompanyProfileResponse: Codable {
    var company: Company
    var companyIcon: CompanyIconView?
}

struct Recommendation: Codable, Identifiable, Hashable {
    var resource: Resource
    var score: Double
    var why: String
    var citations: [String]

    var id: String { resource.id }
}

struct RecommendationResponse: Codable {
    var recommendations: [Recommendation]
    var planCards: [PlanCard]
}

enum PlanDueWindow: String, Codable {
    case today
    case sevenDays = "7_days"
    case thirtyDays = "30_days"
    case ninetyDays = "90_days"

    var label: String {
        switch self {
        case .today: "Today"
        case .sevenDays: "7 days"
        case .thirtyDays: "30 days"
        case .ninetyDays: "90 days"
        }
    }
}

enum PlanStatus: String, Codable {
    case suggested
    case saved
    case done

    var label: String {
        switch self {
        case .suggested: "Queued"
        case .saved: "Active"
        case .done: "Done"
        }
    }
}

struct PlanCard: Codable, Identifiable, Hashable {
    var title: String
    var dueWindow: PlanDueWindow
    var status: PlanStatus

    var id: String { title }
}

struct WizardResponse: Codable {
    var assistantMessage: String
    var recommendations: [Recommendation]
    var planCards: [PlanCard]
    var usedProvider: String
    var guardrails: WizardGuardrails
}

struct WizardGuardrails: Codable {
    var deterministicFilters: Bool
    var citationsRequired: Bool
    var externalBrowsingUsed: Bool
}

enum AuthProviderID: String, CaseIterable, Identifiable, Codable {
    case site
    case google
    case microsoft
    case meta

    var id: String { rawValue }

    var title: String {
        switch self {
        case .site: "Startup State"
        case .google: "Google"
        case .microsoft: "Microsoft"
        case .meta: "Meta"
        }
    }
}

enum UserRole: String, Codable, Hashable {
    case founder
    case companyEditor = "company_editor"
    case reviewer
    case admin

    var label: String {
        switch self {
        case .founder: "Founder"
        case .companyEditor: "Company editor"
        case .reviewer: "Reviewer"
        case .admin: "Admin"
        }
    }
}

struct FounderUser: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var email: String
    var avatarUrl: String?
    var provider: AuthProviderID
    var authProviders: [AuthProviderID]
    var roles: [UserRole]
    var createdAt: String
    var lastSeenAt: String
}

struct UserNotification: Codable, Identifiable, Hashable {
    var id: String
    var userId: String
    var category: String
    var title: String
    var message: String
    var status: String
    var href: String?
    var createdAt: String
    var readAt: String?
}

struct AuthSessionResponse: Codable {
    var user: FounderUser?
    var notifications: [UserNotification]
    var unreadCount: Int
}

struct SignInResponse: Codable {
    var user: FounderUser?
    var notifications: [UserNotification]
    var unreadCount: Int
    var sessions: [FounderSession]?
}

struct SessionTurn: Codable, Identifiable, Hashable {
    var id: String
    var createdAt: String
    var profile: FounderProfile
    var userMessage: String
    var assistantMessage: String
    var usedProvider: String
    var planCards: [PlanCard]
    var completedSteps: [String]
    var recommendationIds: [String]
}

struct FounderSession: Codable, Identifiable, Hashable {
    var id: String
    var userId: String
    var title: String
    var createdAt: String
    var updatedAt: String
    var profile: FounderProfile
    var completedSteps: [String]
    var planCards: [PlanCard]
    var turns: [SessionTurn]
}

struct FounderSessionsResponse: Codable {
    var sessions: [FounderSession]
}

struct FounderSessionResponse: Codable {
    var session: FounderSession
}

struct SessionContext: Codable {
    var sessionId: String?
    var completedSteps: [String]?
    var currentPlanCards: [PlanCard]?
    var previousAssistantMessage: String?
    var history: [SessionContextTurn]?
}

struct SessionContextTurn: Codable {
    var userMessage: String
    var assistantMessage: String
    var completedSteps: [String]?
}

enum AiProvider: String, CaseIterable, Identifiable, Codable {
    case mock
    case openai
    case codexPath
    case anthropic
    case gemini

    var id: String { rawValue }

    var title: String {
        switch self {
        case .mock: "Local guide"
        case .openai: "OpenAI API"
        case .codexPath: "OpenAI Codex path"
        case .anthropic: "Anthropic"
        case .gemini: "Google Gemini"
        }
    }
}

enum ThinkingLevel: String, CaseIterable, Identifiable, Codable {
    case none
    case low
    case medium
    case high
    case xhigh

    var id: String { rawValue }

    var title: String {
        switch self {
        case .none: "None"
        case .low: "Low"
        case .medium: "Medium"
        case .high: "High"
        case .xhigh: "Extra high"
        }
    }
}

struct AiSettings: Codable, Hashable {
    var provider: AiProvider
    var apiKey: String?
    var model: String
    var thinkingLevel: ThinkingLevel
    var codexPath: String?
    var codexHome: String?
    var codexHomeProfile: String?
    var codexAwsVolumeRoot: String?

    static let `default` = AiSettings(
        provider: .mock,
        apiKey: nil,
        model: "basecamp-local-guide",
        thinkingLevel: .medium,
        codexPath: "codex",
        codexHome: nil,
        codexHomeProfile: "auto",
        codexAwsVolumeRoot: nil
    )
}

struct WizardChatRequest: Codable {
    var settings: AiSettings
    var profile: FounderProfile
    var message: String
    var sessionContext: SessionContext?
}

struct RecommendationRequest: Codable {
    var profile: FounderProfile
    var limit: Int
    var orderedIds: [String]
}

struct SaveFounderTurnRequest: Codable {
    var userId: String
    var sessionId: String?
    var profile: FounderProfile
    var userMessage: String
    var assistantMessage: String
    var usedProvider: String
    var planCards: [PlanCard]
    var completedSteps: [String]
    var recommendationIds: [String]
}

struct UpdateFounderProgressRequest: Codable {
    var userId: String
    var sessionId: String
    var completedSteps: [String]
}

struct SignInRequest: Codable {
    var provider: AuthProviderID
    var name: String?
    var email: String?
    var avatarUrl: String?
}

struct NotificationReadResponse: Codable {
    var notifications: [UserNotification]
    var unreadCount: Int
}

struct CompanyDraftInput: Codable, Hashable {
    var companySlug: String
    var name: String
    var website: String
    var workEmail: String
    var sector: String
    var stage: String
    var employees: String
    var address: String
    var description: String
    var linkedin: String
    var foundedYear: String
    var hiringStatus: HiringStatus
    var jobsUrl: String
    var atsUrl: String
    var jobPostings: String
    var gallery: String

    static let empty = CompanyDraftInput(
        companySlug: "",
        name: "",
        website: "",
        workEmail: "",
        sector: "",
        stage: "",
        employees: "",
        address: "",
        description: "",
        linkedin: "",
        foundedYear: "",
        hiringStatus: .unknown,
        jobsUrl: "",
        atsUrl: "",
        jobPostings: "",
        gallery: ""
    )
}

struct CompanyDraftSubmissionResponse: Codable {
    var id: String?
    var reviewStatus: String?
    var verificationStatus: String?
    var domainMatch: CompanyDraftDomainMatch?
    var magicLinkSent: Bool?
    var emailDeliveryStatus: String?
}

struct CompanyDraftSummary: Codable, Identifiable, Hashable {
    var id: String
    var status: String
    var verificationStatus: String
    var submittedAt: String
    var emailDeliveryStatus: String
    var domainMatch: CompanyDraftDomainMatch?
    var changes: [CompanyDraftChange]?
    var payload: CompanyDraftPayload?
}

struct CompanyDraftPayload: Codable, Hashable {
    var name: String
    var workEmail: String?
}

struct CompanyDraftDomainMatch: Codable, Hashable {
    var ok: Bool
    var reason: String
    var emailDomain: String?
    var websiteDomain: String?
}

struct CompanyDraftChange: Codable, Identifiable, Hashable {
    var field: String
    var before: String
    var after: String

    var id: String { field }
}

struct CompanyDraftReviewRequest: Codable {
    var id: String
    var action: String
    var reviewerNote: String?
}

struct AdminSummaryResponse: Codable {
    var resourceCount: Int
    var companyCount: Int
    var needsReview: Int
    var drafts: [CompanyDraftSummary]
}

struct PublicCompanyImportSource: Codable, Hashable {
    var id: String
    var name: String
    var description: String
    var url: String
    var steward: String
    var license: String
    var updateCadence: String
    var reliabilityNote: String
}

struct PublicCompanyImportPreview: Codable {
    var source: PublicCompanyImportSource
    var availableCount: Int
    var defaultLimit: Int
    var maxLimit: Int
    var categories: [String]
    var fetchedCount: Int?
    var importedCount: Int?
    var skippedDuplicateCount: Int?
    var storedPath: String?
}

struct PublicCompanyImportRequest: Codable {
    var limit: Int
}

struct AdminImportRequest: Codable {
    var kind: String
    var csv: String
}

struct AdminImportResponse: Codable {
    var count: Int?
    var error: String?
}

struct AdminIntegrationSettings: Codable {
    var updatedAt: String?
    var googleMaps: AdminGoogleMapsSettings
}

struct AdminGoogleMapsSettings: Codable {
    var browserApiKey: String?
    var browserApiKeyPreview: String
    var hasBrowserApiKey: Bool
    var mapId: String
    var techMapId: String
    var serverGeocodingKeyPreview: String
    var hasServerGeocodingKey: Bool
}

struct IntegrationPatchRequest: Codable {
    var googleMaps: GoogleMapsPatch?
}

struct GoogleMapsPatch: Codable {
    var browserApiKey: String?
    var geocodingApiKey: String?
    var mapId: String?
    var techMapId: String?
    var clearBrowserApiKey: Bool?
    var clearGeocodingApiKey: Bool?
}

struct ATSPreviewRequest: Codable {
    var url: String
}

struct ATSPreviewResponse: Codable {
    var jobs: [JobPosting]?
}

struct GalleryUploadResponse: Codable {
    var urls: [String]?
}

struct HealthResponse: Codable {
    var ok: Bool?
    var service: String?
    var version: String?
    var commit: String?
    var storageWritable: Bool?
}

struct AppSettings: Codable, Hashable {
    var serverURL: String
    var theme: BasecampTheme
    var aiSettings: AiSettings
    var showExtraMapData: Bool

    static let `default` = AppSettings(
        serverURL: "https://basecamp.ntechr.com",
        theme: .tech,
        aiSettings: .default,
        showExtraMapData: true
    )
}

struct BootstrapCache: Codable {
    var savedAt: Date
    var serverURL: String
    var platform: PlatformBootstrapResponse?
    var map: MapBootstrapResponse?
    var auth: AuthSessionResponse?
    var sessions: [FounderSession]
}
