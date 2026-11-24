import SwiftUI

/*
 * A card that floats up from the bottom of the screen, over everything (the tab bar too), with the screen blurred
 * and see-through behind it. It's as tall as what's in it, and scrolls inside when that's taller than most of the
 * screen. Tap outside it, drag its little bar down or tap Done to close it.
 *
 * Every menu opens in one: how you're feeling, your person, the invite, decorating, the record player, the pet,
 * settings, your look, Plus, the bucket list and the rest, as well as the Us page's tiles. So they all look and
 * move the same. (The website does the same with a card in the middle of the screen: `.st-frost`.)
 *
 * A menu inside a card closes itself with `@MenuDismiss` (instead of the sheet's `dismiss`), and scrolls with
 * `MenuScroll` (the card does the scrolling).
 */

@MainActor @Observable
final class FloatingCard {
    static let shared = FloatingCard()
    private(set) var content: AnyView?
    /// counts up each time a card opens, so each one is a fresh view
    private(set) var shown = 0
    /// put what's in it on a paper card (false: it's made of its own cards, like the Us tiles' menus)
    private(set) var boxed = false
    /// as tall as the card can be, whatever's in it (for a menu that sizes itself to the room it has, like
    /// decorating or Plus); otherwise the card fits what's in it
    private(set) var fill = false

    /// where cards show: the tabs, and anything that covers them (the escape rooms). The newest one shows the card.
    private(set) var hosts: [Int] = []
    private var lastHost = 0
    /// the host the open card belongs to
    private(set) var cardHost: Int?

    func show<V: View>(boxed: Bool = false, fill: Bool = false, @ViewBuilder _ view: () -> V) {
        Haptics.tap()
        let next = AnyView(view())
        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
            content = next
            self.boxed = boxed
            self.fill = fill
            cardHost = hosts.last
            shown += 1
        }
    }

    func close() {
        guard content != nil else { return }
        withAnimation(.easeOut(duration: 0.2)) { content = nil }
    }

    func attach() -> Int {
        lastHost += 1
        hosts.append(lastHost)
        return lastHost
    }

    func detach(_ id: Int) {
        hosts.removeAll { $0 == id }
        // (a card opened over something that's gone goes with it)
        if cardHost == id { content = nil }
    }
}

private struct InFloatingCardKey: EnvironmentKey { static let defaultValue = false }

extension EnvironmentValues {
    /// this view is in a floating card (so it closes the card, not a sheet)
    var inFloatingCard: Bool {
        get { self[InFloatingCardKey.self] }
        set { self[InFloatingCardKey.self] = newValue }
    }
}

/// closes a menu: the floating card it's in, or else the sheet or page it was opened as
@propertyWrapper
struct MenuDismiss: DynamicProperty {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.inFloatingCard) private var inCard

    init() {}

    var wrappedValue: () -> Void {
        let system = self.dismiss, card = self.inCard
        return {
            MainActor.assumeIsolated {
                if card { FloatingCard.shared.close() } else { system() }
            }
        }
    }
}

extension View {
    /// a menu that floats up as a card when `isPresented` turns on (it turns straight back off: the card closes
    /// itself, with Done, a tap above it, a pull down or the menu's own buttons)
    @MainActor
    func floatingMenu<M: View>(isPresented: Binding<Bool>, boxed: Bool = true, fill: Bool = false, @ViewBuilder _ menu: @escaping () -> M) -> some View {
        onChange(of: isPresented.wrappedValue) { _, on in
            guard on else { return }
            isPresented.wrappedValue = false
            FloatingCard.shared.show(boxed: boxed, fill: fill, menu)
        }
    }

    /// the same, for a menu about something (a photo, a reason for Plus): it floats up when `item` is set
    @MainActor
    func floatingMenu<Item: Identifiable, M: View>(item: Binding<Item?>, boxed: Bool = true, fill: Bool = false, @ViewBuilder _ menu: @escaping (Item) -> M) -> some View {
        onChange(of: item.wrappedValue?.id) { _, id in
            guard id != nil, let v = item.wrappedValue else { return }
            item.wrappedValue = nil
            FloatingCard.shared.show(boxed: boxed, fill: fill) { menu(v) }
        }
    }
}

/// a menu's scrolling: in a floating card the card scrolls (and fits the menu), anywhere else the menu does
struct MenuScroll<Content: View>: View {
    @Environment(\.inFloatingCard) private var inCard
    @ViewBuilder var content: () -> Content

    var body: some View {
        if inCard { content() } else { ScrollView { content() } }
    }
}

private struct FloatingCardHeight: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// where the card shows: over the whole screen, on top of the tabs (Main.swift)
struct FloatingCardHost: View {
    @State private var card = FloatingCard.shared
    /// how tall what's in the card is (it's measured, then the card fits it)
    @State private var height: CGFloat = 0
    @GestureState private var pull: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// this host's number (FloatingCard.hosts)
    @State private var me = 0

    /// the open card, if it's this host's to show
    private var mine: AnyView? { me != 0 && (card.cardHost ?? card.hosts.last) == me && card.hosts.last == me ? card.content : nil }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                if let content = mine {
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .overlay(Color.black.opacity(0.22))
                        .ignoresSafeArea()
                        .onTapGesture { card.close() }
                        .accessibilityLabel("Close")
                        .accessibilityAddTraits(.isButton)
                        .transition(.opacity)
                    VStack(spacing: 8) {
                        handle
                        Group {
                            if card.fill {
                                // (a menu that sizes itself gets the whole card, and scrolls itself if it needs to)
                                boxed(AnyView(content.frame(maxHeight: .infinity, alignment: .top))).frame(height: geo.size.height * 0.86)
                            } else {
                                ScrollView {
                                    boxed(content)
                                        // (room for the cards' own shadows)
                                        .padding(.trailing, 4)
                                        .padding(.bottom, 6)
                                        .background(GeometryReader { g in
                                            Color.clear.preference(key: FloatingCardHeight.self, value: g.size.height)
                                        })
                                }
                                .scrollBounceBehavior(.basedOnSize)
                                .scrollDismissesKeyboard(.interactively)
                                .frame(height: min(max(height, 60), geo.size.height * 0.82))
                                .onPreferenceChange(FloatingCardHeight.self) { height = $0 }
                            }
                        }
                        .environment(\.inFloatingCard, true)
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 10)
                    .offset(y: max(0, pull))
                    .id(card.shown)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .allowsHitTesting(mine != nil)
        .onAppear { if me == 0 { me = card.attach() } }
        .onDisappear {
            card.detach(me)
            me = 0
        }
    }

    /// a menu goes on a paper card; the Us tiles' menus are made of their own cards
    @ViewBuilder
    private func boxed(_ content: AnyView) -> some View {
        if card.boxed {
            content.frame(maxWidth: .infinity, alignment: .leading).pxBox(.paper, shadow: true)
        } else {
            content.frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// a little bar to pull the card down by, and Done
    private var handle: some View {
        CardHandle { card.close() }
            .gesture(
                DragGesture()
                    .updating($pull) { value, state, _ in state = value.translation.height }
                    .onEnded { value in if value.translation.height > 70 { card.close() } }
            )
    }
}

/// the bar along the top of a floating card: a little handle, and Done
struct CardHandle: View {
    let done: () -> Void

    var body: some View {
        ZStack {
            Rectangle().fill(Color.paper.opacity(0.85)).frame(width: 44, height: 6)
            HStack {
                Spacer()
                Button("Done", action: done).buttonStyle(.px(.paper, small: true))
            }
        }
        .frame(height: 40)
        .contentShape(Rectangle())
    }
}

/*
 * Every other menu (the invite, how you're feeling, settings, your look, Plus, decorating, the record player and
 * the rest) still opens as a sheet, but dressed the same as the floating cards: the screen blurred and see-through
 * behind it, the menu as a paper card at the bottom with the same bar and Done on top. Tapping the blurred part
 * closes it, as does pulling it down. A menu that's taller than the screen fills it and scrolls inside.
 */
private struct FrostedSheet: ViewModifier {
    @Environment(\.dismiss) private var dismiss
    /// put it on a paper card (false: it's already made of its own cards, like the Us tiles' menus)
    let boxed: Bool

    func body(content: Content) -> some View {
        VStack(spacing: 8) {
            // the blurred screen above the card
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { dismiss() }
                .accessibilityHidden(true)
            CardHandle { dismiss() }
            Group {
                if boxed {
                    content.frame(maxWidth: .infinity, alignment: .leading).pxBox(.paper, shadow: true)
                } else {
                    content.frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            // (the card gets the room it needs first; whatever's left is the blur above it)
            .layoutPriority(1)
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(0)
        .presentationBackground {
            Rectangle().fill(.ultraThinMaterial).overlay(Color.black.opacity(0.22))
        }
        .environment(\.inFloatingCard, false)
    }
}

extension View {
    /// a menu in a sheet, dressed like the floating cards (see FrostedSheet)
    func frostedSheet(boxed: Bool = true) -> some View { modifier(FrostedSheet(boxed: boxed)) }
}
