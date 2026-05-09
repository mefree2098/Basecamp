import SwiftUI

struct BasecampPalette {
    var background: Color
    var elevated: Color
    var panel: Color
    var panelStrong: Color
    var line: Color
    var text: Color
    var muted: Color
    var cyan: Color
    var blue: Color
    var green: Color
    var orange: Color
    var red: Color
    var purple: Color
    var shadow: Color

    static func palette(for theme: BasecampTheme) -> BasecampPalette {
        switch theme {
        case .tech:
            BasecampPalette(
                background: Color(red: 0.01, green: 0.03, blue: 0.08),
                elevated: Color(red: 0.02, green: 0.08, blue: 0.16),
                panel: Color(red: 0.02, green: 0.07, blue: 0.14).opacity(0.88),
                panelStrong: Color(red: 0.03, green: 0.10, blue: 0.20),
                line: Color(red: 0.13, green: 0.47, blue: 0.86).opacity(0.55),
                text: Color(red: 0.92, green: 0.96, blue: 1.0),
                muted: Color(red: 0.62, green: 0.70, blue: 0.83),
                cyan: Color(red: 0.12, green: 0.78, blue: 1.0),
                blue: Color(red: 0.16, green: 0.42, blue: 1.0),
                green: Color(red: 0.24, green: 0.94, blue: 0.47),
                orange: Color(red: 1.0, green: 0.47, blue: 0.10),
                red: Color(red: 1.0, green: 0.22, blue: 0.24),
                purple: Color(red: 0.68, green: 0.24, blue: 1.0),
                shadow: Color(red: 0.0, green: 0.56, blue: 1.0).opacity(0.28)
            )
        case .classic:
            BasecampPalette(
                background: Color(red: 0.96, green: 0.98, blue: 0.96),
                elevated: Color.white,
                panel: Color.white.opacity(0.94),
                panelStrong: Color(red: 0.99, green: 0.98, blue: 0.95),
                line: Color(red: 0.82, green: 0.87, blue: 0.84),
                text: Color(red: 0.08, green: 0.13, blue: 0.12),
                muted: Color(red: 0.36, green: 0.41, blue: 0.40),
                cyan: Color(red: 0.05, green: 0.56, blue: 0.55),
                blue: Color(red: 0.08, green: 0.39, blue: 0.85),
                green: Color(red: 0.07, green: 0.51, blue: 0.27),
                orange: Color(red: 0.86, green: 0.42, blue: 0.10),
                red: Color(red: 0.73, green: 0.28, blue: 0.21),
                purple: Color(red: 0.43, green: 0.24, blue: 0.80),
                shadow: Color.black.opacity(0.10)
            )
        }
    }
}

struct PaletteKey: EnvironmentKey {
    static var defaultValue = BasecampPalette.palette(for: .tech)
}

extension EnvironmentValues {
    var palette: BasecampPalette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }
}

struct AppBackground: View {
    @Environment(\.palette) private var palette
    let theme: BasecampTheme

    var body: some View {
        ZStack {
            palette.background.ignoresSafeArea()
            if theme == .tech {
                LinearGradient(
                    colors: [
                        Color(red: 0.00, green: 0.02, blue: 0.07),
                        Color(red: 0.02, green: 0.07, blue: 0.16),
                        Color(red: 0.00, green: 0.03, blue: 0.09)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                RadialGradient(
                    colors: [palette.blue.opacity(0.22), .clear],
                    center: .bottom,
                    startRadius: 20,
                    endRadius: 420
                )
                .ignoresSafeArea()
            } else {
                LinearGradient(
                    colors: [
                        Color(red: 0.98, green: 0.98, blue: 0.94),
                        Color(red: 0.91, green: 0.96, blue: 0.97)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            }
        }
    }
}

struct GlassPanel<Content: View>: View {
    @Environment(\.palette) private var palette
    let padding: CGFloat
    let content: Content

    init(padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(palette.panel)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(palette.line, lineWidth: 1)
                    )
                    .shadow(color: palette.shadow, radius: 18, x: 0, y: 10)
            )
    }
}

struct NeonButtonStyle: ButtonStyle {
    @Environment(\.palette) private var palette
    var tint: Color?
    var filled = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(filled ? Color.white : (tint ?? palette.cyan))
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(filled ? (tint ?? palette.blue).opacity(configuration.isPressed ? 0.65 : 0.92) : palette.panelStrong.opacity(configuration.isPressed ? 0.65 : 0.82))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke((tint ?? palette.cyan).opacity(0.9), lineWidth: 1)
                    )
                    .shadow(color: (tint ?? palette.cyan).opacity(configuration.isPressed ? 0.10 : 0.28), radius: 12)
            )
    }
}

struct IconCircleButton: View {
    @Environment(\.palette) private var palette
    var symbol: String
    var accessibilityLabel: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .frame(width: 44, height: 44)
        }
        .foregroundStyle(palette.text)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(palette.panelStrong.opacity(0.88))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(palette.line, lineWidth: 1)
                )
        )
        .accessibilityLabel(accessibilityLabel)
    }
}

struct Pill: View {
    @Environment(\.palette) private var palette
    var title: String
    var symbol: String?
    var tint: Color?

    var body: some View {
        HStack(spacing: 6) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.system(size: 12, weight: .bold))
            }
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .lineLimit(1)
        }
        .foregroundStyle(tint ?? palette.cyan)
        .padding(.horizontal, 10)
        .frame(minHeight: 30)
        .background(
            Capsule()
                .fill((tint ?? palette.cyan).opacity(0.12))
                .overlay(Capsule().stroke((tint ?? palette.cyan).opacity(0.42), lineWidth: 1))
        )
    }
}

struct MetricCard: View {
    @Environment(\.palette) private var palette
    var title: String
    var value: String
    var detail: String
    var symbol: String
    var tint: Color
    var compact = false

    var body: some View {
        GlassPanel(padding: compact ? 11 : 14) {
            HStack(spacing: compact ? 9 : 12) {
                Image(systemName: symbol)
                    .font(.system(size: compact ? 18 : 22, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: compact ? 34 : 42, height: compact ? 34 : 42)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(tint.opacity(0.12))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(tint.opacity(0.45), lineWidth: 1))
                    )
                VStack(alignment: .leading, spacing: 3) {
                    Text(title.uppercased())
                        .font(.system(size: compact ? 9 : 11, weight: .bold))
                        .foregroundStyle(palette.muted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    Text(value)
                        .font(.system(size: compact ? 22 : 27, weight: .black, design: .rounded))
                        .foregroundStyle(palette.text)
                    Text(detail)
                        .font(.system(size: compact ? 10 : 12, weight: .bold))
                        .foregroundStyle(tint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct BrandMark: View {
    @Environment(\.palette) private var palette
    var compact = false
    var showUtah = true

    var body: some View {
        HStack(spacing: compact ? 7 : 10) {
            LogoGlyph()
                .frame(width: compact ? 42 : 56, height: compact ? 38 : 48)
            VStack(alignment: .leading, spacing: 0) {
                Text("STARTUP")
                Text("STATE")
            }
            .font(.system(size: compact ? 15 : 19, weight: .black))
            .foregroundStyle(palette.text)
            .lineSpacing(-2)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            if showUtah {
                Text("UTAH")
                    .font(.system(size: compact ? 13 : 16, weight: .black))
                    .foregroundStyle(palette.orange)
                    .tracking(1.2)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct LogoGlyph: View {
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            Path { path in
                path.move(to: CGPoint(x: 4, y: 42))
                path.addLine(to: CGPoint(x: 28, y: 4))
                path.addLine(to: CGPoint(x: 52, y: 42))
                path.addLine(to: CGPoint(x: 40, y: 42))
                path.addLine(to: CGPoint(x: 28, y: 21))
                path.addLine(to: CGPoint(x: 16, y: 42))
                path.closeSubpath()
            }
            .fill(
                LinearGradient(
                    colors: [palette.red, palette.orange],
                    startPoint: .bottomLeading,
                    endPoint: .topTrailing
                )
            )
            Path { path in
                path.move(to: CGPoint(x: 18, y: 38))
                path.addLine(to: CGPoint(x: 28, y: 21))
                path.addLine(to: CGPoint(x: 39, y: 38))
                path.addLine(to: CGPoint(x: 31, y: 38))
                path.addLine(to: CGPoint(x: 28, y: 32))
                path.addLine(to: CGPoint(x: 25, y: 38))
                path.closeSubpath()
            }
            .fill(palette.purple.opacity(0.92))
        }
        .shadow(color: palette.orange.opacity(0.32), radius: 10)
    }
}

struct EmptyStateView: View {
    @Environment(\.palette) private var palette
    var symbol: String
    var title: String
    var detail: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(palette.cyan)
            Text(title)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(palette.text)
            Text(detail)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(palette.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(28)
    }
}

extension View {
    func basecampCard() -> some View {
        modifier(BasecampCardModifier())
    }
}

struct BasecampCardModifier: ViewModifier {
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(palette.panel)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(palette.line, lineWidth: 1)
                    )
            )
    }
}
