import SwiftUI

struct FounderNavigatorScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Environment(\.openURL) private var openURL
    @State private var message = ""
    @State private var profile = FounderProfile.empty
    @State private var response: WizardResponse?
    @State private var activeSession: FounderSession?
    @State private var completedSteps = Set<String>()
    @State private var activeResourceID: String?
    @State private var loading = false
    @State private var status = ""
    @State private var showingSessions = false

    private var turns: [SessionTurn] {
        activeSession?.turns ?? []
    }

    private var activeRecommendations: [Recommendation] {
        response?.recommendations ?? []
    }

    private var activeResource: Resource? {
        if let id = activeResourceID,
           let resource = activeRecommendations.first(where: { $0.resource.id == id })?.resource {
            return resource
        }
        return activeRecommendations.first?.resource
    }

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 820
            Group {
                if compact {
                    compactLayout
                } else {
                    wideLayout
                }
            }
            .padding(compact ? 14 : 20)
            .task {
                seedProfile()
                await restoreLatestIfPossible()
            }
        }
    }

    private var wideLayout: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 14) {
                navigatorHeader
                chatPanel
            }
            .frame(maxWidth: .infinity)
            VStack(spacing: 14) {
                accountAndSessions
                planPanel
                resourcePanel
            }
            .frame(width: 380)
        }
    }

    private var compactLayout: some View {
        ScrollView {
            VStack(spacing: 14) {
                navigatorHeader
                accountAndSessions
                chatPanel
                planPanel
                resourcePanel
            }
        }
    }

    private var navigatorHeader: some View {
        GlassPanel {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(palette.purple)
                    .frame(width: 52, height: 52)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(palette.purple.opacity(0.12))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.purple.opacity(0.45), lineWidth: 1))
                    )
                VStack(alignment: .leading, spacing: 6) {
                    Text("Founder Navigator")
                        .font(.system(size: 30, weight: .black))
                        .foregroundStyle(palette.text)
                    Text(status.isEmpty ? "Ask Basecamp what to do next, then keep the plan moving across iOS and web." : status)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(palette.muted)
                }
                Spacer()
                Button {
                    showingSessions.toggle()
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .buttonStyle(NeonButtonStyle())
            }
        }
    }

    private var chatPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 14) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if turns.isEmpty && response == nil {
                                starterPrompts
                            }
                            ForEach(turns) { turn in
                                ChatBubble(role: "You", text: turn.userMessage, mine: true)
                                ChatBubble(role: "Basecamp", text: turn.assistantMessage, mine: false)
                            }
                            if let response, turns.last?.assistantMessage != response.assistantMessage {
                                ChatBubble(role: "Basecamp", text: response.assistantMessage, mine: false)
                            }
                            if loading {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text("Creating a plan...")
                                        .foregroundStyle(palette.muted)
                                }
                                .padding(.vertical, 10)
                            }
                            Color.clear.frame(height: 1).id("bottom")
                        }
                    }
                    .frame(minHeight: 330)
                    .onChange(of: turns.count) { _, _ in
                        withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                    }
                    .onChange(of: response?.assistantMessage ?? "") { _, _ in
                        withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    TextField("Tell Basecamp what you are trying to do...", text: $message, axis: .vertical)
                        .lineLimit(2...5)
                        .padding(12)
                        .foregroundStyle(palette.text)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(palette.panelStrong.opacity(0.78))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                        )
                    HStack {
                        profilePickers
                        Spacer()
                        Button {
                            Task { await runMessage(message) }
                        } label: {
                            Label(loading ? "Sending" : "Send", systemImage: "paperplane.fill")
                        }
                        .buttonStyle(NeonButtonStyle(tint: palette.cyan, filled: true))
                        .disabled(message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || loading)
                    }
                }
            }
        }
        .sheet(isPresented: $showingSessions) {
            SessionHistorySheet(activeSession: $activeSession, response: $response, completedSteps: $completedSteps)
                .environmentObject(store)
                .environment(\.palette, palette)
        }
    }

    private var starterPrompts: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Start with a founder question")
                .font(.system(size: 17, weight: .black))
                .foregroundStyle(palette.text)
            ForEach([
                "I'm starting a landscaping business in St. George. What do I do first?",
                "I'm a pre-revenue software founder in Lehi and need the right state resources.",
                "I have customers and need help finding funding and local investors."
            ], id: \.self) { prompt in
                Button {
                    message = prompt
                    Task { await runMessage(prompt) }
                } label: {
                    HStack {
                        Text(prompt)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(palette.text)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: "arrow.right")
                            .foregroundStyle(palette.cyan)
                    }
                    .padding(12)
                    .basecampCard()
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var profilePickers: some View {
        HStack(spacing: 8) {
            Menu {
                ForEach(FounderStage.allCases) { stage in
                    Button(stage.title) { profile.stage = stage }
                }
            } label: {
                Pill(title: profile.stage.title, symbol: "flag", tint: palette.blue)
            }
            Menu {
                let industries = store.platform?.founderOptions.industries ?? []
                ForEach(industries.prefix(40), id: \.self) { item in
                    Button(item) { profile.industry = item }
                }
            } label: {
                Pill(title: profile.industry.isEmpty ? "Industry" : profile.industry, symbol: "building.columns", tint: palette.purple)
            }
        }
    }

    private var accountAndSessions: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                if let user = store.auth.user {
                    HStack(spacing: 12) {
                        AvatarView(user: user, size: 48)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name)
                                .font(.system(size: 17, weight: .black))
                                .foregroundStyle(palette.text)
                            Text("\(store.founderSessions.count) saved conversations")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(palette.muted)
                        }
                        Spacer()
                        Button("Sign out") {
                            Task { await store.signOut() }
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(palette.red)
                    }
                    if let session = store.founderSessions.first {
                        Button {
                            restore(session)
                        } label: {
                            Label("Resume \(session.title)", systemImage: "arrow.uturn.forward.circle")
                                .lineLimit(1)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(NeonButtonStyle())
                    }
                } else {
                    InlineSignInPanel(context: "Save and resume navigator progress.")
                }
            }
        }
    }

    private var planPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Plan Status", systemImage: "checklist")
                        .font(.system(size: 18, weight: .black))
                        .foregroundStyle(palette.text)
                    Spacer()
                    if let activeSession {
                        Text(activeSession.updatedAt.formattedRelativeDate)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(palette.muted)
                    }
                }
                let cards = response?.planCards ?? activeSession?.planCards ?? []
                if cards.isEmpty {
                    EmptyStateView(symbol: "list.bullet.clipboard", title: "No plan yet", detail: "Send a message and Basecamp will create the first trackable steps.")
                } else {
                    ForEach(cards) { card in
                        Button {
                            toggleStep(card.title)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: completedSteps.contains(card.title) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(completedSteps.contains(card.title) ? palette.green : palette.muted)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(card.title)
                                        .font(.system(size: 14, weight: .heavy))
                                        .foregroundStyle(palette.text)
                                        .multilineTextAlignment(.leading)
                                    Text(completedSteps.contains(card.title) ? "Done" : card.dueWindow.label)
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(completedSteps.contains(card.title) ? palette.green : palette.muted)
                                }
                                Spacer()
                            }
                            .padding(10)
                            .basecampCard()
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var resourcePanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Label("Exact Pages", systemImage: "link")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(palette.text)
                if activeRecommendations.isEmpty {
                    EmptyStateView(symbol: "book", title: "No resource matches yet", detail: "Recommendations will appear with the first navigator response.")
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(activeRecommendations) { recommendation in
                                Button {
                                    activeResourceID = recommendation.resource.id
                                } label: {
                                    Text(recommendation.resource.title)
                                        .font(.system(size: 12, weight: .heavy))
                                        .lineLimit(1)
                                        .padding(.horizontal, 10)
                                        .frame(height: 32)
                                }
                                .background(
                                    Capsule()
                                        .fill(activeResourceID == recommendation.resource.id ? palette.cyan.opacity(0.22) : palette.panelStrong)
                                        .overlay(Capsule().stroke(palette.line, lineWidth: 1))
                                )
                                .foregroundStyle(activeResourceID == recommendation.resource.id ? palette.cyan : palette.text)
                            }
                        }
                    }
                    if let activeResource {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(activeResource.title)
                                .font(.system(size: 18, weight: .black))
                                .foregroundStyle(palette.text)
                            Text(activeResource.description)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(palette.text.opacity(0.78))
                            FlowTags(tags: Array(activeResource.topics.prefix(3)))
                            Button {
                                if let url = URL(string: activeResource.link) {
                                    openURL(url)
                                }
                            } label: {
                                Label("Open direct page", systemImage: "arrow.up.right")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(NeonButtonStyle(tint: palette.purple, filled: true))
                        }
                    }
                }
            }
        }
    }

    private func seedProfile() {
        guard profile == .empty else { return }
        let options = store.platform?.founderOptions
        profile.industry = options?.industries.first ?? profile.industry
        profile.county = options?.counties.first(where: { $0.localizedCaseInsensitiveContains("Salt") }) ?? options?.counties.first ?? profile.county
        profile.community = options?.communities.first(where: { $0.localizedCaseInsensitiveContains("Salt") }) ?? options?.communities.first ?? profile.community
    }

    private func restoreLatestIfPossible() async {
        guard activeSession == nil else { return }
        if let first = store.founderSessions.first {
            restore(first)
        } else if store.auth.user != nil {
            await store.refreshFounderSessions()
            if let first = store.founderSessions.first {
                restore(first)
            }
        }
    }

    private func restore(_ session: FounderSession) {
        activeSession = session
        profile = session.profile
        completedSteps = Set(session.completedSteps)
        if let last = session.turns.last {
            let ordered = store.resources.filter { last.recommendationIds.contains($0.id) }
            response = WizardResponse(
                assistantMessage: last.assistantMessage,
                recommendations: ordered.map {
                    Recommendation(resource: $0, score: 1, why: "Saved from this conversation.", citations: [])
                },
                planCards: session.planCards,
                usedProvider: last.usedProvider,
                guardrails: WizardGuardrails(deterministicFilters: true, citationsRequired: true, externalBrowsingUsed: false)
            )
            activeResourceID = last.recommendationIds.first
        }
        status = "Loaded your last navigator conversation."
    }

    private func runMessage(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !loading else { return }
        loading = true
        status = "Creating your next plan..."
        message = ""
        profile = inferredProfile(from: trimmed, current: profile)
        do {
            let next = try await store.sendWizardMessage(
                message: trimmed,
                profile: profile,
                session: activeSession,
                completedSteps: Array(completedSteps)
            )
            response = next
            activeResourceID = next.recommendations.first?.resource.id
            if store.auth.user != nil {
                let session = try await store.persistFounderTurn(
                    sessionId: activeSession?.id,
                    profile: profile,
                    userMessage: trimmed,
                    response: next,
                    completedSteps: Array(completedSteps)
                )
                activeSession = session
                status = "Saved to Basecamp."
            } else {
                status = "Create a profile to save this conversation."
            }
        } catch {
            do {
                let fallback = try await store.fallbackRecommendations(profile: profile, limit: 6)
                response = WizardResponse(
                    assistantMessage: "I could not reach the live guide, so I matched your request against the Startup State resource data. Start with the first exact page, then tell me what the page asks for and I will help you work through it.",
                    recommendations: fallback.recommendations,
                    planCards: fallback.planCards,
                    usedProvider: "mock",
                    guardrails: WizardGuardrails(deterministicFilters: true, citationsRequired: true, externalBrowsingUsed: false)
                )
                activeResourceID = fallback.recommendations.first?.resource.id
                status = "Used deterministic recommendations while the live guide was unavailable."
            } catch {
                status = store.userFacing(error)
            }
        }
        loading = false
    }

    private func toggleStep(_ title: String) {
        if completedSteps.contains(title) {
            completedSteps.remove(title)
        } else {
            completedSteps.insert(title)
        }
        guard let activeSession else { return }
        Task {
            do {
                let next = try await store.updateFounderProgress(sessionId: activeSession.id, completedSteps: Array(completedSteps))
                self.activeSession = next
                status = "Progress saved."
            } catch {
                status = store.userFacing(error)
            }
        }
    }

    private func inferredProfile(from message: String, current: FounderProfile) -> FounderProfile {
        var next = current
        next.goal = message
        next.mode = .chat
        let lower = message.lowercased()
        if lower.contains("fund") || lower.contains("venture") || lower.contains("investor") || lower.contains("raise") {
            next.stage = .fund
        } else if lower.contains("customer") || lower.contains("revenue") || lower.contains("grow") {
            next.stage = .grow
        } else if lower.contains("idea") || lower.contains("validate") {
            next.stage = .validate
        } else if lower.contains("sell") || lower.contains("exit") {
            next.stage = .exit
        }
        if lower.contains("software") || lower.contains("saas") || lower.contains("tech") {
            next.industry = "Technology"
        } else if lower.contains("restaurant") || lower.contains("food") {
            next.industry = "Food"
        } else if lower.contains("manufacturing") {
            next.industry = "Advanced Manufacturing"
        }
        for county in store.platform?.founderOptions.counties ?? [] where lower.contains(county.lowercased()) {
            next.county = county
        }
        for community in store.platform?.founderOptions.communities ?? [] where lower.contains(community.lowercased()) {
            next.community = community
        }
        return next
    }
}

struct ChatBubble: View {
    @Environment(\.palette) private var palette
    var role: String
    var text: String
    var mine: Bool

    var body: some View {
        HStack(alignment: .top) {
            if mine { Spacer(minLength: 30) }
            VStack(alignment: .leading, spacing: 5) {
                Text(role)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(mine ? palette.cyan : palette.purple)
                Text(text)
                    .font(.system(size: 15, weight: .semibold))
                    .lineSpacing(3)
                    .foregroundStyle(palette.text)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(mine ? palette.blue.opacity(0.18) : palette.panelStrong.opacity(0.84))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(mine ? palette.blue.opacity(0.45) : palette.line, lineWidth: 1))
            )
            if !mine { Spacer(minLength: 30) }
        }
    }
}

struct InlineSignInPanel: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    var context: String
    @State private var name = ""
    @State private var email = ""
    @State private var status = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Create your profile", systemImage: "person.crop.circle.badge.plus")
                .font(.system(size: 17, weight: .black))
                .foregroundStyle(palette.text)
            Text(context)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(palette.muted)
            TextField("Name", text: $name)
                .textContentType(.name)
                .fieldChrome()
            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .fieldChrome()
            HStack {
                Button {
                    Task { await signIn(.site) }
                } label: {
                    Label("Register", systemImage: "person.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle(tint: palette.cyan, filled: true))
                Menu {
                    Button("Microsoft") { Task { await signIn(.microsoft) } }
                    Button("Google") { Task { await signIn(.google) } }
                    Button("Meta") { Task { await signIn(.meta) } }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .frame(width: 44, height: 44)
                }
                .foregroundStyle(palette.text)
            }
            if !status.isEmpty {
                Text(status)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(palette.muted)
            }
        }
    }

    private func signIn(_ provider: AuthProviderID) async {
        do {
            try await store.signIn(provider: provider, name: name.isEmpty ? nil : name, email: email.isEmpty ? nil : email)
            status = "Profile ready."
        } catch {
            status = store.userFacing(error)
        }
    }
}

struct SessionHistorySheet: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette
    @Binding var activeSession: FounderSession?
    @Binding var response: WizardResponse?
    @Binding var completedSteps: Set<String>

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground(theme: store.settings.theme)
                List(store.founderSessions) { session in
                    Button {
                        activeSession = session
                        completedSteps = Set(session.completedSteps)
                        if let last = session.turns.last {
                            let ordered = store.resources.filter { last.recommendationIds.contains($0.id) }
                            response = WizardResponse(
                                assistantMessage: last.assistantMessage,
                                recommendations: ordered.map { Recommendation(resource: $0, score: 1, why: "Saved from this conversation.", citations: []) },
                                planCards: session.planCards,
                                usedProvider: last.usedProvider,
                                guardrails: WizardGuardrails(deterministicFilters: true, citationsRequired: true, externalBrowsingUsed: false)
                            )
                        }
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(session.title)
                                .font(.system(size: 16, weight: .heavy))
                            Text(session.updatedAt.formattedRelativeDate)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(palette.muted)
                        }
                    }
                    .listRowBackground(Color.clear)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Saved Conversations")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await store.refreshFounderSessions()
            }
        }
    }
}

extension View {
    func fieldChrome() -> some View {
        modifier(FieldChromeModifier())
    }
}

struct FieldChromeModifier: ViewModifier {
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .foregroundStyle(palette.text)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(palette.panelStrong.opacity(0.76))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
            )
    }
}

extension String {
    var formattedRelativeDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: self) else { return self }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .short
        return relative.localizedString(for: date, relativeTo: Date())
    }
}
