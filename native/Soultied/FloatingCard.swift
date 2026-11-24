import SwiftUI

/*
 * A card that floats up from the bottom of the screen, over everything (the tab bar too), with the screen blurred
 * and see-through behind it. It's as tall as what's in it, and scrolls inside when that's taller than most of the
 * screen. Tap outside it, drag its little bar down or tap Done to close it. The Us page's tiles open in one.
 * (The website does the same with a card in the middle of the screen: UsPage.tsx.)
 */

@MainActor @Observable
final class FloatingCard {
    static let shared = FloatingCard()
    private(set) var content: AnyView?
    /// counts up each time a card opens, so each one is a fresh view
    private(set) var shown = 0

    func show<V: View>(@ViewBuilder _ view: () -> V) {
        Haptics.tap()
        let next = AnyView(view())
        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
            content = next
            shown += 1
        }
    }

    func close() {
        guard content != nil else { return }
        withAnimation(.easeOut(duration: 0.2)) { content = nil }
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

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                if let content = card.content {
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
                        ScrollView {
                            content
                                .frame(maxWidth: .infinity, alignment: .leading)
                                // (room for the cards' own shadows)
                                .padding(.trailing, 4)
                                .padding(.bottom, 6)
                                .background(GeometryReader { g in
                                    Color.clear.preference(key: FloatingCardHeight.self, value: g.size.height)
                                })
                        }
                        .scrollBounceBehavior(.basedOnSize)
                        .scrollDismissesKeyboard(.interactively)
                        .frame(height: min(max(height, 60), geo.size.height * 0.8))
                        .onPreferenceChange(FloatingCardHeight.self) { height = $0 }
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
        .allowsHitTesting(card.content != nil)
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
    }
}

extension View {
    /// a menu in a sheet, dressed like the floating cards (see FrostedSheet)
    func frostedSheet(boxed: Bool = true) -> some View { modifier(FrostedSheet(boxed: boxed)) }
}
